-- Permanent invoicing-only plan: complete invoicing and client management,
-- without access to the accounting automation product.

insert into public.plan_limits (
  plan,
  label,
  price_monthly,
  ocr_limit,
  storage_gb,
  dossiers_limit,
  users_limit,
  employee_limit,
  has_bank_import,
  has_saisie,
  has_paie,
  has_export_fiduciaire,
  has_avoirs,
  has_bilan,
  has_tva_edi,
  has_inbox_global,
  has_mass_declarations,
  has_whatsapp_agent
)
values (
  'free',
  'Mohasib Gratuit',
  0,
  0,
  0,
  0,
  1,
  0,
  false,
  false,
  false,
  false,
  true,
  false,
  false,
  false,
  false,
  false
)
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

-- This trigger runs after the historical trial normalizer (trigger names are
-- ordered alphabetically). Only users who explicitly selected the
-- invoicing-only signup are moved to the permanent free plan.
create or replace function public.assign_free_plan_to_invoicing_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_mode text;
begin
  select coalesce(
    raw_user_meta_data->>'account_mode',
    case when raw_user_meta_data->>'requested_plan' = 'free' then 'invoicing' else null end
  )
  into requested_mode
  from auth.users
  where id = new.user_id;

  if requested_mode = 'invoicing'
     and new.plan = 'trial'
     and new.subscription_status = 'trial' then
    new.plan := 'free';
    new.subscription_status := 'free';
    new.trial_ends_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_assign_free_plan_to_invoicing_accounts_trigger on public.companies;
create trigger zz_assign_free_plan_to_invoicing_accounts_trigger
before insert or update of user_type, plan, subscription_status on public.companies
for each row execute function public.assign_free_plan_to_invoicing_accounts();

-- Convert only accounts that explicitly requested invoicing-only access.
update public.companies
set
  plan = 'free',
  subscription_status = 'free',
  trial_ends_at = null
where subscription_status = 'trial'
  and exists (
    select 1
    from auth.users
    where auth.users.id = public.companies.user_id
      and (
        auth.users.raw_user_meta_data->>'account_mode' = 'invoicing'
        or auth.users.raw_user_meta_data->>'requested_plan' = 'free'
      )
  );

notify pgrst, 'reload schema';
