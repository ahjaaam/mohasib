-- Keep signup records out of the operational demo queue and give every trial
-- full feature access with strict volume caps.

alter table public.companies
  add column if not exists trial_documents_used integer default 0;

-- Both Entrepreneur and Comptable Pro signups use the full-feature trial
-- entitlement set. The company user_type still controls which workspace opens.
update public.companies
set plan = 'trial'
where subscription_status = 'trial';

create or replace function public.normalize_trial_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subscription_status = 'trial' then
    new.plan := 'trial';
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_trial_plan_trigger on public.companies;
create trigger normalize_trial_plan_trigger
before insert or update of plan, subscription_status on public.companies
for each row execute function public.normalize_trial_plan();

update public.plan_limits
set
  ocr_limit = -1,
  storage_gb = 1,
  dossiers_limit = -1,
  users_limit = 2,
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
    when 'documents' then 'trial_documents_used'
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
    when 'documents' then 'trial_documents_used'
    when 'bank_statements' then 'trial_bank_statements_used'
    when 'employees' then 'trial_employees_used'
    when 'tva_declarations' then 'trial_tva_declarations_used'
    when 'dossiers' then 'trial_dossiers_used'
    else null
  end;

  fixed_limit := case feature_arg
    when 'invoices' then 10
    when 'ocr_scans' then 10
    when 'documents' then 10
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

  if used_count >= fixed_limit then
    raise exception 'trial_limit_reached:%:%:%', feature_arg, used_count, fixed_limit;
  end if;

  perform public.increment_trial_usage(company_row.id, feature_arg);
end;
$$;

create or replace function public.enforce_trial_company_document_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_trial_limit_for_owner(new.user_id, 'documents');
  return new;
end;
$$;

drop trigger if exists enforce_trial_company_document_limit_trigger on public.company_documents;
create trigger enforce_trial_company_document_limit_trigger
before insert on public.company_documents
for each row execute function public.enforce_trial_company_document_limit();

-- Let trial accounts validate one TVA declaration so the feature is genuinely
-- testable. Count only the transition into a validated/filed state.
create or replace function public.enforce_trial_dossier_tva_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_is_valid boolean;
  old_is_valid boolean := false;
begin
  new_is_valid := coalesce(new.statut, '') in ('validé', 'validée', 'deposee', 'déposé', 'déposée');
  if tg_op = 'UPDATE' then
    old_is_valid := coalesce(old.statut, '') in ('validé', 'validée', 'deposee', 'déposé', 'déposée');
  end if;
  if new_is_valid and not old_is_valid then
    perform public.enforce_trial_limit_for_owner(new.fiduciaire_user_id, 'tva_declarations');
  end if;
  return new;
end;
$$;

create or replace function public.enforce_trial_company_tva_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_is_valid boolean;
  old_is_valid boolean := false;
begin
  new_is_valid :=
    coalesce(new.statut, '') in ('validé', 'validée', 'deposee', 'déposé', 'déposée')
    or coalesce(new.status, '') in ('filed', 'validated');
  if tg_op = 'UPDATE' then
    old_is_valid :=
      coalesce(old.statut, '') in ('validé', 'validée', 'deposee', 'déposé', 'déposée')
      or coalesce(old.status, '') in ('filed', 'validated');
  end if;
  if new_is_valid and not old_is_valid then
    perform public.enforce_trial_limit_for_owner(new.user_id, 'tva_declarations');
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
