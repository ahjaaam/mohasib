-- Address Supabase Security Advisor warnings without making public tables broadly writable.

-- 1) Pin search_path for holiday helper functions.
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
      and p.proname in ('hijri_to_gregorian', 'populate_islamic_holidays', 'ensure_holidays_populated', 'handle_new_user', 'increment_upload_count')
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.args
    );
  end loop;
end $$;

-- 2) Remove broad direct execution of internal SECURITY DEFINER functions.
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
      and p.proname in ('handle_new_user', 'increment_upload_count')
  loop
    execute format('revoke execute on function %I.%I(%s) from public', fn.schema_name, fn.function_name, fn.args);
    execute format('revoke execute on function %I.%I(%s) from anon', fn.schema_name, fn.function_name, fn.args);
    execute format('revoke execute on function %I.%I(%s) from authenticated', fn.schema_name, fn.function_name, fn.args);
  end loop;
end $$;

-- 3) Replace overly broad INSERT/ALL policies flagged by the linter.

do $$
begin
  if to_regclass('public.access_requests') is not null then
    execute 'drop policy if exists "Anyone can submit access request" on public.access_requests';
    execute 'alter table public.access_requests enable row level security';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'access_requests' and column_name = 'email'
    ) then
      execute 'create policy "Anyone can submit access request" on public.access_requests for insert to anon, authenticated with check (email is not null and length(email) between 3 and 320)';
    end if;
  end if;

  if to_regclass('public.custom_requests') is not null then
    execute 'drop policy if exists "Allow insert" on public.custom_requests';
    execute 'alter table public.custom_requests enable row level security';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'custom_requests' and column_name = 'email'
    ) then
      execute 'create policy "Anyone can submit custom request" on public.custom_requests for insert to anon, authenticated with check (email is not null and length(email) between 3 and 320)';
    end if;
  end if;

  if to_regclass('public.fiduciaire_waitlist') is not null then
    execute 'drop policy if exists "anyone_can_join_waitlist" on public.fiduciaire_waitlist';
    execute 'drop policy if exists "Anyone can insert fiduciaire_waitlist" on public.fiduciaire_waitlist';
    execute 'alter table public.fiduciaire_waitlist enable row level security';
    execute 'create policy "Anyone can join waitlist with email" on public.fiduciaire_waitlist for insert to anon, authenticated with check (email is not null and length(email) between 3 and 320)';
    execute 'drop policy if exists "Anyone can read waitlist count" on public.fiduciaire_waitlist';
    execute 'create policy "Anyone can read waitlist count" on public.fiduciaire_waitlist for select to anon, authenticated using (true)';
  end if;

  if to_regclass('public.invoice_views') is not null then
    execute 'drop policy if exists "Anyone can insert invoice views" on public.invoice_views';
    execute 'alter table public.invoice_views enable row level security';
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'invoice_views' and column_name = 'invoice_id'
    ) then
      execute 'create policy "Anyone can record invoice view" on public.invoice_views for insert to anon, authenticated with check (invoice_id is not null)';
    end if;
  end if;

  if to_regclass('public.accounting_events') is not null then
    execute 'drop policy if exists "Insert events" on public.accounting_events';
    execute 'alter table public.accounting_events enable row level security';
    execute 'create policy "Authenticated users can insert accounting events" on public.accounting_events for insert to authenticated with check (auth.uid() is not null)';
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute 'drop policy if exists "Insert audit logs" on public.audit_logs';
    execute 'alter table public.audit_logs enable row level security';
  end if;

  if to_regclass('public.rate_limits') is not null then
    execute 'drop policy if exists "Allow rate limits management" on public.rate_limits';
    execute 'alter table public.rate_limits enable row level security';
  end if;
end $$;
