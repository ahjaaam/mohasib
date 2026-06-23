-- Expand trial caps so every feature remains testable but not usable at
-- serious production volume.

alter table public.companies
  add column if not exists trial_clients_used integer default 0,
  add column if not exists trial_transactions_used integer default 0,
  add column if not exists trial_accounting_entries_used integer default 0,
  add column if not exists trial_rapprochement_sessions_used integer default 0,
  add column if not exists trial_rapprochement_matches_used integer default 0;

-- Bank import UI already sends these fields. Keep them for better attribution
-- and to avoid counting imported bank rows as manually-created transactions.
alter table public.transactions
  add column if not exists source text,
  add column if not exists bank_reference text;

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
    when 'clients' then 'trial_clients_used'
    when 'transactions' then 'trial_transactions_used'
    when 'accounting_entries' then 'trial_accounting_entries_used'
    when 'rapprochement_sessions' then 'trial_rapprochement_sessions_used'
    when 'rapprochement_matches' then 'trial_rapprochement_matches_used'
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

create or replace function public.enforce_trial_limit_for_company(
  company_id_arg uuid,
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
  where id = company_id_arg
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
    when 'clients' then 'trial_clients_used'
    when 'transactions' then 'trial_transactions_used'
    when 'accounting_entries' then 'trial_accounting_entries_used'
    when 'rapprochement_sessions' then 'trial_rapprochement_sessions_used'
    when 'rapprochement_matches' then 'trial_rapprochement_matches_used'
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
    when 'clients' then 5
    when 'transactions' then 20
    when 'accounting_entries' then 20
    when 'rapprochement_sessions' then 1
    when 'rapprochement_matches' then 20
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

create or replace function public.enforce_trial_limit_for_owner(
  owner_user_id uuid,
  feature_arg text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  company_id_value uuid;
begin
  select id into company_id_value
  from public.companies
  where user_id = owner_user_id;

  if company_id_value is null then
    return;
  end if;

  perform public.enforce_trial_limit_for_company(company_id_value, feature_arg);
end;
$$;

create or replace function public.enforce_trial_client_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dossier_owner uuid;
begin
  if new.dossier_id is not null then
    select fiduciaire_user_id into dossier_owner
    from public.dossiers
    where id = new.dossier_id;
    perform public.enforce_trial_limit_for_owner(dossier_owner, 'clients');
  else
    perform public.enforce_trial_limit_for_owner(new.user_id, 'clients');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_client_limit_trigger on public.clients;
create trigger enforce_trial_client_limit_trigger
before insert on public.clients
for each row execute function public.enforce_trial_client_limit();

create or replace function public.enforce_trial_transaction_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dossier_owner uuid;
begin
  -- Bank statement imports are already capped by the bank statement limit.
  -- Invoice payment transactions are capped indirectly by invoice limits.
  if coalesce(new.source, '') = 'bank_import' or new.invoice_id is not null then
    return new;
  end if;

  if new.dossier_id is not null then
    select fiduciaire_user_id into dossier_owner
    from public.dossiers
    where id = new.dossier_id;
    perform public.enforce_trial_limit_for_owner(dossier_owner, 'transactions');
  else
    perform public.enforce_trial_limit_for_owner(new.user_id, 'transactions');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_transaction_limit_trigger on public.transactions;
create trigger enforce_trial_transaction_limit_trigger
before insert on public.transactions
for each row execute function public.enforce_trial_transaction_limit();

create or replace function public.enforce_trial_accounting_entry_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.source_type, 'manual') = 'manual' then
    perform public.enforce_trial_limit_for_company(new.company_id, 'accounting_entries');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_accounting_entry_limit_trigger on public.ecritures_comptables;
create trigger enforce_trial_accounting_entry_limit_trigger
before insert on public.ecritures_comptables
for each row execute function public.enforce_trial_accounting_entry_limit();

create or replace function public.enforce_trial_dossier_accounting_entry_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_trial_limit_for_owner(new.fiduciaire_user_id, 'accounting_entries');
  return new;
end;
$$;

drop trigger if exists enforce_trial_dossier_accounting_entry_limit_trigger on public.dossier_ecritures;
create trigger enforce_trial_dossier_accounting_entry_limit_trigger
before insert on public.dossier_ecritures
for each row execute function public.enforce_trial_dossier_accounting_entry_limit();

create or replace function public.enforce_trial_rapprochement_session_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dossier_owner uuid;
begin
  if new.company_id is not null then
    perform public.enforce_trial_limit_for_company(new.company_id, 'rapprochement_sessions');
  elsif new.dossier_id is not null then
    select fiduciaire_user_id into dossier_owner
    from public.dossiers
    where id = new.dossier_id;
    perform public.enforce_trial_limit_for_owner(dossier_owner, 'rapprochement_sessions');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_rapprochement_session_limit_trigger on public.rapprochement_sessions;
create trigger enforce_trial_rapprochement_session_limit_trigger
before insert on public.rapprochement_sessions
for each row execute function public.enforce_trial_rapprochement_session_limit();

create or replace function public.enforce_trial_rapprochement_match_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.rapprochement_sessions%rowtype;
  new_is_matched boolean;
  old_is_matched boolean := false;
  dossier_owner uuid;
begin
  new_is_matched := coalesce(new.statut, '') = 'rapproché';
  if tg_op = 'UPDATE' then
    old_is_matched := coalesce(old.statut, '') = 'rapproché';
  end if;

  if new_is_matched and not old_is_matched then
    select * into target_session
    from public.rapprochement_sessions
    where id = new.session_id;

    if target_session.company_id is not null then
      perform public.enforce_trial_limit_for_company(target_session.company_id, 'rapprochement_matches');
    elsif target_session.dossier_id is not null then
      select fiduciaire_user_id into dossier_owner
      from public.dossiers
      where id = target_session.dossier_id;
      perform public.enforce_trial_limit_for_owner(dossier_owner, 'rapprochement_matches');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trial_rapprochement_match_limit_insert_trigger on public.rapprochement_lignes;
create trigger enforce_trial_rapprochement_match_limit_insert_trigger
before insert on public.rapprochement_lignes
for each row execute function public.enforce_trial_rapprochement_match_limit();

drop trigger if exists enforce_trial_rapprochement_match_limit_update_trigger on public.rapprochement_lignes;
create trigger enforce_trial_rapprochement_match_limit_update_trigger
before update of statut on public.rapprochement_lignes
for each row execute function public.enforce_trial_rapprochement_match_limit();

notify pgrst, 'reload schema';
