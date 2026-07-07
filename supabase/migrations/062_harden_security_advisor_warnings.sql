-- Harden warnings reported by Supabase Database Linter.
--
-- This migration intentionally avoids revoking authenticated access from
-- public.member_has_permission because current RLS policies call it directly.
-- Moving that helper to a non-exposed schema should be handled in a dedicated
-- RLS refactor.

-- 1) Pin search_path for append-only guard trigger functions.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'prevent_audit_logs_mutation',
        'prevent_accounting_events_mutation'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.args
    );
  end loop;
end $$;

-- 2) Revoke direct RPC execution for internal SECURITY DEFINER helpers/triggers.
-- Triggers can still execute these functions; service_role keeps access for
-- server-only maintenance/RPC paths.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'effective_numeric_plan_limit',
        'enforce_dossier_plan_limit',
        'enforce_employee_plan_limit',
        'enforce_trial_accounting_entry_limit',
        'enforce_trial_bank_statement_limit',
        'enforce_trial_client_limit',
        'enforce_trial_company_document_limit',
        'enforce_trial_company_tva_validation',
        'enforce_trial_dossier_accounting_entry_limit',
        'enforce_trial_dossier_limit',
        'enforce_trial_dossier_tva_validation',
        'enforce_trial_employee_limit',
        'enforce_trial_invoice_limit',
        'enforce_trial_limit_for_company',
        'enforce_trial_limit_for_owner',
        'enforce_trial_rapprochement_match_limit',
        'enforce_trial_rapprochement_session_limit',
        'enforce_trial_transaction_limit',
        'increment_trial_usage',
        'log_financial_table_change',
        'queue_demo_request'
      )
  loop
    execute format('revoke execute on function %I.%I(%s) from public', fn.schema_name, fn.function_name, fn.args);
    execute format('revoke execute on function %I.%I(%s) from anon', fn.schema_name, fn.function_name, fn.args);
    execute format('revoke execute on function %I.%I(%s) from authenticated', fn.schema_name, fn.function_name, fn.args);

    if to_regrole('service_role') is not null then
      execute format('grant execute on function %I.%I(%s) to service_role', fn.schema_name, fn.function_name, fn.args);
    end if;
  end loop;
end $$;

-- 3) Remove anon access from RLS helper functions, but keep authenticated
-- access because many active RLS policies evaluate these helpers.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'member_has_permission'
  loop
    execute format('revoke execute on function %I.%I(%s) from public', fn.schema_name, fn.function_name, fn.args);
    execute format('revoke execute on function %I.%I(%s) from anon', fn.schema_name, fn.function_name, fn.args);
    execute format('grant execute on function %I.%I(%s) to authenticated', fn.schema_name, fn.function_name, fn.args);

    if to_regrole('service_role') is not null then
      execute format('grant execute on function %I.%I(%s) to service_role', fn.schema_name, fn.function_name, fn.args);
    end if;
  end loop;
end $$;

-- 4) Replace overly broad INSERT policies with scoped authenticated policies.
do $$
begin
  if to_regclass('public.accounting_events') is not null then
    execute 'drop policy if exists "Insert events" on public.accounting_events';
    execute 'drop policy if exists "Authenticated users can insert accounting events" on public.accounting_events';
    execute 'alter table public.accounting_events enable row level security';
    execute $policy$
      create policy "Authenticated users can insert accounting events"
        on public.accounting_events
        for insert
        to authenticated
        with check (
          triggered_by = auth.uid()
          or company_id in (
            select id from public.companies where user_id = auth.uid()
          )
          or company_id in (
            select company_id from public.user_memberships
            where user_id = auth.uid() and status = 'active'
          )
          or dossier_id in (
            select id from public.dossiers where fiduciaire_user_id = auth.uid()
          )
        )
    $policy$;
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute 'drop policy if exists "System can insert logs" on public.audit_logs';
    execute 'drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs';
    execute 'alter table public.audit_logs enable row level security';
    execute $policy$
      create policy "Authenticated users can insert audit logs"
        on public.audit_logs
        for insert
        to authenticated
        with check (
          user_id = auth.uid()
          or company_id in (
            select id from public.companies where user_id = auth.uid()
          )
          or company_id in (
            select company_id from public.user_memberships
            where user_id = auth.uid() and status = 'active'
          )
          or dossier_id in (
            select id from public.dossiers where fiduciaire_user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;
