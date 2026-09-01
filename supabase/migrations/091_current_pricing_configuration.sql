-- Persist the current Entreprise/Cabinet quote behind each paid account.
-- Historical package names remain untouched on old subscription rows.

alter table public.companies
  add column if not exists pricing_configuration jsonb,
  add column if not exists quoted_monthly_mad numeric;

alter table public.subscriptions
  add column if not exists pricing_configuration jsonb;

insert into public.plan_limits (
  plan, label, price_monthly, ocr_limit, storage_gb, dossiers_limit,
  users_limit, employee_limit, has_bank_import, has_saisie, has_paie,
  has_export_fiduciaire, has_avoirs, has_bilan, has_tva_edi,
  has_inbox_global, has_mass_declarations, has_whatsapp_agent
)
values
  ('entreprise', 'Entreprise', 299, 100, -1, 0, 1, 20, true, true, true, true, true, true, true, false, false, true),
  ('cabinet', 'Cabinet', 899, 1000, -1, 10, 12, 20, true, true, true, true, true, true, true, true, true, true)
on conflict (plan) do update set
  label = excluded.label,
  price_monthly = excluded.price_monthly,
  ocr_limit = excluded.ocr_limit,
  storage_gb = excluded.storage_gb,
  dossiers_limit = excluded.dossiers_limit,
  users_limit = excluded.users_limit,
  employee_limit = excluded.employee_limit,
  has_bank_import = excluded.has_bank_import,
  has_saisie = excluded.has_saisie,
  has_paie = excluded.has_paie,
  has_export_fiduciaire = excluded.has_export_fiduciaire,
  has_avoirs = excluded.has_avoirs,
  has_bilan = excluded.has_bilan,
  has_tva_edi = excluded.has_tva_edi,
  has_inbox_global = excluded.has_inbox_global,
  has_mass_declarations = excluded.has_mass_declarations,
  has_whatsapp_agent = excluded.has_whatsapp_agent;

alter table public.companies
  drop constraint if exists companies_quoted_monthly_mad_nonnegative,
  add constraint companies_quoted_monthly_mad_nonnegative
    check (quoted_monthly_mad is null or quoted_monthly_mad >= 0);

create index if not exists idx_companies_pricing_audience
  on public.companies ((pricing_configuration ->> 'audience'))
  where pricing_configuration is not null;

-- Access state, subscription history, and the attached quote must commit or
-- roll back together. This priced variant is defined here because the pricing
-- columns are introduced by this migration.
create or replace function public.admin_set_company_access_priced(
  p_company_id uuid,
  p_status text,
  p_end_date date,
  p_billing_period text,
  p_amount_mad numeric,
  p_payment_method text,
  p_payment_reference text,
  p_created_by_email text,
  p_restart boolean,
  p_plan text,
  p_pricing_configuration jsonb,
  p_quoted_monthly_mad numeric
)
returns table(status text, ends_at date, subscription_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.companies%rowtype;
  v_subscription_id uuid;
  v_paid_plan text;
begin
  if p_status not in ('free', 'trial', 'active', 'grace', 'expired') then
    raise exception 'invalid subscription status';
  end if;
  if p_status = 'active' and (p_end_date is null or p_end_date < current_date) then
    raise exception 'active access requires a current or future end date';
  end if;
  if p_amount_mad is null or p_amount_mad < 0 then
    raise exception 'amount must be positive or zero';
  end if;
  if p_quoted_monthly_mad is not null and p_quoted_monthly_mad < 0 then
    raise exception 'quoted monthly amount must be positive or zero';
  end if;

  v_paid_plan := case when p_plan in ('entreprise', 'cabinet') then p_plan else 'custom' end;
  if p_status = 'active' and (
    p_pricing_configuration is null
    or v_paid_plan = 'custom'
    or p_pricing_configuration ->> 'audience' is distinct from v_paid_plan
    or p_quoted_monthly_mad is null
  ) then
    raise exception 'active access requires a valid pricing configuration';
  end if;

  select * into v_company
  from public.companies
  where id = p_company_id
  for update;

  if not found then
    raise exception 'company not found';
  end if;

  update public.companies
  set
    plan = case when p_status = 'free' then 'free' when p_status = 'trial' then 'trial' else v_paid_plan end,
    subscription_status = p_status,
    subscription_ends_at = case when p_status = 'free' then null when p_status = 'trial' then v_company.subscription_ends_at else p_end_date end,
    trial_ends_at = case
      when p_status = 'free' then null
      when p_status = 'trial' and p_end_date is not null then p_end_date::timestamp + interval '1 day' - interval '1 millisecond'
      else v_company.trial_ends_at
    end,
    scheduled_plan = null,
    scheduled_plan_date = null,
    pricing_configuration = coalesce(p_pricing_configuration, v_company.pricing_configuration),
    quoted_monthly_mad = coalesce(p_quoted_monthly_mad, v_company.quoted_monthly_mad)
  where id = p_company_id;

  if p_status = 'active' then
    update public.subscriptions as subscription
    set status = 'cancelled'
    where subscription.company_id = p_company_id and subscription.status = 'active';

    insert into public.subscriptions (
      company_id, plan, previous_plan, change_type, billing_period,
      amount_mad, payment_method, payment_reference, starts_at, ends_at,
      status, created_by_email, pricing_configuration
    ) values (
      p_company_id,
      v_paid_plan,
      v_company.plan,
      case when v_company.subscription_status = 'active' then 'renewal' when p_restart then 'restart' else 'activation' end,
      case when p_billing_period = 'annual' then 'annual' else 'monthly' end,
      p_amount_mad,
      nullif(p_payment_method, ''),
      nullif(p_payment_reference, ''),
      current_date,
      p_end_date,
      'active',
      p_created_by_email,
      p_pricing_configuration
    ) returning id into v_subscription_id;
  end if;

  return query select p_status, p_end_date, v_subscription_id;
end;
$$;

revoke all on function public.admin_set_company_access_priced(uuid, text, date, text, numeric, text, text, text, boolean, text, jsonb, numeric) from public;
grant execute on function public.admin_set_company_access_priced(uuid, text, date, text, numeric, text, text, text, boolean, text, jsonb, numeric) to service_role;

-- Saving a quote also changes effective entitlements and any active
-- subscription amount, so all three records are updated transactionally.
create or replace function public.admin_save_company_pricing(
  p_company_id uuid,
  p_plan text,
  p_pricing_configuration jsonb,
  p_quoted_monthly_mad numeric,
  p_ocr_limit integer,
  p_storage_gb integer,
  p_dossiers_limit integer,
  p_users_limit integer,
  p_employee_limit integer,
  p_created_by_email text
)
returns table(company_plan text, active_subscriptions_updated integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.companies%rowtype;
  v_company_plan text;
  v_active_subscriptions_updated integer;
begin
  if p_plan not in ('entreprise', 'cabinet')
    or p_pricing_configuration is null
    or p_pricing_configuration ->> 'audience' is distinct from p_plan then
    raise exception 'invalid pricing configuration';
  end if;
  if p_quoted_monthly_mad is null or p_quoted_monthly_mad < 0 then
    raise exception 'quoted monthly amount must be positive or zero';
  end if;
  if p_ocr_limit < 0 or p_dossiers_limit < 0 or p_users_limit < 1 or p_employee_limit < 0 then
    raise exception 'invalid pricing entitlements';
  end if;

  select * into v_company
  from public.companies
  where id = p_company_id
  for update;

  if not found then
    raise exception 'company not found';
  end if;

  v_company_plan := case
    when v_company.subscription_status in ('free', 'trial') then v_company.plan
    else p_plan
  end;

  update public.companies
  set
    plan = v_company_plan,
    pricing_configuration = p_pricing_configuration,
    quoted_monthly_mad = p_quoted_monthly_mad
  where id = p_company_id;

  insert into public.company_limit_overrides (
    company_id, ocr_limit, storage_gb, dossiers_limit, users_limit,
    employee_limit, has_paie, has_bank_import, has_saisie,
    has_export_fiduciaire, has_avoirs, has_bilan, has_tva_edi,
    has_inbox_global, has_mass_declarations, has_whatsapp_agent,
    reason, expires_at, created_by_email, updated_at
  ) values (
    p_company_id, p_ocr_limit, p_storage_gb, p_dossiers_limit, p_users_limit,
    p_employee_limit, true, true, true, true, true, true, true, true, true,
    true, 'Configuration tarifaire Mohasib', null, p_created_by_email, now()
  )
  on conflict (company_id) do update set
    ocr_limit = excluded.ocr_limit,
    storage_gb = excluded.storage_gb,
    dossiers_limit = excluded.dossiers_limit,
    users_limit = excluded.users_limit,
    employee_limit = excluded.employee_limit,
    has_paie = excluded.has_paie,
    has_bank_import = excluded.has_bank_import,
    has_saisie = excluded.has_saisie,
    has_export_fiduciaire = excluded.has_export_fiduciaire,
    has_avoirs = excluded.has_avoirs,
    has_bilan = excluded.has_bilan,
    has_tva_edi = excluded.has_tva_edi,
    has_inbox_global = excluded.has_inbox_global,
    has_mass_declarations = excluded.has_mass_declarations,
    has_whatsapp_agent = excluded.has_whatsapp_agent,
    reason = excluded.reason,
    expires_at = excluded.expires_at,
    created_by_email = excluded.created_by_email,
    updated_at = excluded.updated_at;

  update public.subscriptions
  set
    plan = p_plan,
    pricing_configuration = p_pricing_configuration,
    amount_mad = case when billing_period = 'annual' then p_quoted_monthly_mad * 12 else p_quoted_monthly_mad end
  where company_id = p_company_id and status = 'active';
  get diagnostics v_active_subscriptions_updated = row_count;

  return query select v_company_plan, v_active_subscriptions_updated;
end;
$$;

revoke all on function public.admin_save_company_pricing(uuid, text, jsonb, numeric, integer, integer, integer, integer, integer, text) from public;
grant execute on function public.admin_save_company_pricing(uuid, text, jsonb, numeric, integer, integer, integer, integer, integer, text) to service_role;

notify pgrst, 'reload schema';
