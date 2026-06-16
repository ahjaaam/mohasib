-- Strict trial volume caps. Trial keeps full feature access, but creation is
-- capped by fixed counters.

alter table public.companies
  add column if not exists trial_invoices_used integer default 0,
  add column if not exists trial_ocr_used integer default 0,
  add column if not exists trial_bank_statements_used integer default 0,
  add column if not exists trial_employees_used integer default 0,
  add column if not exists trial_tva_declarations_used integer default 0,
  add column if not exists trial_dossiers_used integer default 0;

update public.plan_limits set
  ocr_limit = -1,
  dossiers_limit = -1,
  users_limit = greatest(coalesce(users_limit, 1), 3),
  employee_limit = -1,
  has_bank_import = true,
  has_saisie = true,
  has_paie = true,
  has_export_fiduciaire = true,
  has_avoirs = true,
  has_bilan = true,
  has_tva_edi = true,
  has_inbox_global = true,
  has_mass_declarations = true
where plan = 'trial';

create or replace function public.increment_trial_usage(
  company_id_arg uuid,
  feature_arg text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_column text;
begin
  usage_column := case feature_arg
    when 'invoices' then 'trial_invoices_used'
    when 'ocr_scans' then 'trial_ocr_used'
    when 'bank_statements' then 'trial_bank_statements_used'
    when 'employees' then 'trial_employees_used'
    when 'tva_declarations' then 'trial_tva_declarations_used'
    when 'dossiers' then 'trial_dossiers_used'
    else null
  end;

  if usage_column is null then
    raise exception 'unknown trial feature %', feature_arg;
  end if;

  execute format(
    'update public.companies set %I = coalesce(%I, 0) + 1 where id = $1',
    usage_column,
    usage_column
  ) using company_id_arg;
end;
$$;

create or replace function public.enforce_trial_limit_for_owner(
  owner_user_id uuid,
  feature_arg text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  company_row public.companies%rowtype;
  usage_column text;
  used_count integer;
  fixed_limit integer;
begin
  select * into company_row
  from public.companies
  where user_id = owner_user_id
  for update;

  if company_row.id is null or company_row.subscription_status is distinct from 'trial' then
    return;
  end if;

  usage_column := case feature_arg
    when 'invoices' then 'trial_invoices_used'
    when 'ocr_scans' then 'trial_ocr_used'
    when 'bank_statements' then 'trial_bank_statements_used'
    when 'employees' then 'trial_employees_used'
    when 'tva_declarations' then 'trial_tva_declarations_used'
    when 'dossiers' then 'trial_dossiers_used'
    else null
  end;

  fixed_limit := case feature_arg
    when 'invoices' then 10
    when 'ocr_scans' then 10
    when 'bank_statements' then 1
    when 'employees' then 1
    when 'tva_declarations' then 1
    when 'dossiers' then 1
    else null
  end;

  if usage_column is null or fixed_limit is null then
    raise exception 'unknown trial feature %', feature_arg;
  end if;

  execute format('select coalesce(%I, 0) from public.companies where id = $1', usage_column)
    into used_count
    using company_row.id;

  if feature_arg = 'tva_declarations' then
    raise exception 'trial_feature_locked:tva_declarations:%:%', used_count, fixed_limit;
  end if;

  if used_count >= fixed_limit then
    raise exception 'trial_limit_reached:%:%:%', feature_arg, used_count, fixed_limit;
  end if;

  perform public.increment_trial_usage(company_row.id, feature_arg);
end;
$$;

create or replace function public.enforce_trial_invoice_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.invoice_type, 'facture') in ('facture', 'devis', 'avoir_client', 'avoir_fournisseur') then
    perform public.enforce_trial_limit_for_owner(new.user_id, 'invoices');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_invoice_limit_trigger on public.invoices;
create trigger enforce_trial_invoice_limit_trigger
before insert on public.invoices
for each row execute function public.enforce_trial_invoice_limit();

create or replace function public.enforce_trial_bank_statement_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_trial_limit_for_owner(new.user_id, 'bank_statements');
  return new;
end;
$$;

drop trigger if exists enforce_trial_bank_statement_limit_trigger on public.bank_statements;
create trigger enforce_trial_bank_statement_limit_trigger
before insert on public.bank_statements
for each row execute function public.enforce_trial_bank_statement_limit();

create or replace function public.enforce_trial_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_trial_limit_for_owner(new.user_id, 'employees');
  return new;
end;
$$;

drop trigger if exists enforce_trial_employee_limit_trigger on public.employees;
create trigger enforce_trial_employee_limit_trigger
before insert on public.employees
for each row execute function public.enforce_trial_employee_limit();

create or replace function public.enforce_trial_dossier_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_trial_limit_for_owner(new.fiduciaire_user_id, 'dossiers');
  return new;
end;
$$;

drop trigger if exists enforce_trial_dossier_limit_trigger on public.dossiers;
create trigger enforce_trial_dossier_limit_trigger
before insert on public.dossiers
for each row execute function public.enforce_trial_dossier_limit();

create or replace function public.enforce_trial_dossier_tva_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.statut, '') in ('validé', 'validée', 'deposee', 'déposé', 'déposée') then
    perform public.enforce_trial_limit_for_owner(new.fiduciaire_user_id, 'tva_declarations');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_dossier_tva_validation_trigger on public.dossier_tva;
create trigger enforce_trial_dossier_tva_validation_trigger
before insert or update on public.dossier_tva
for each row execute function public.enforce_trial_dossier_tva_validation();

create or replace function public.enforce_trial_company_tva_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.statut, '') in ('validé', 'validée', 'deposee', 'déposé', 'déposée')
    or coalesce(new.status, '') in ('filed', 'validated') then
    perform public.enforce_trial_limit_for_owner(new.user_id, 'tva_declarations');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_company_tva_validation_trigger on public.tva_declarations;
create trigger enforce_trial_company_tva_validation_trigger
before insert or update on public.tva_declarations
for each row execute function public.enforce_trial_company_tva_validation();

notify pgrst, 'reload schema';
