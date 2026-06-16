-- Complete audit and compliance layer.
-- This migration repairs older partial tables and adds append-only protection.

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  user_email text,
  company_id uuid references public.companies,
  dossier_id uuid references public.dossiers,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  ip_address text,
  user_agent text,
  device_type text,
  session_id text,
  request_method text,
  request_path text,
  success boolean default true,
  error_message text,
  checksum text,
  created_at timestamptz default now() not null
);

alter table public.audit_logs
  add column if not exists device_type text,
  add column if not exists session_id text,
  add column if not exists request_method text,
  add column if not exists request_path text,
  add column if not exists success boolean default true,
  add column if not exists error_message text;

create or replace function public.prevent_audit_logs_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_logs_mutation();

alter table public.audit_logs enable row level security;

drop policy if exists "Users can read scoped audit logs" on public.audit_logs;
drop policy if exists "Users can read own company logs" on public.audit_logs;
create policy "Users can read scoped audit logs"
  on public.audit_logs
  for select
  using (
    user_id = auth.uid()
    or company_id in (select id from public.companies where user_id = auth.uid())
    or company_id in (
      select company_id from public.user_memberships
      where user_id = auth.uid() and status = 'active'
    )
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users can insert scoped audit logs" on public.audit_logs;
drop policy if exists "System can insert logs" on public.audit_logs;
drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
create policy "System can insert logs"
  on public.audit_logs
  for insert
  with check (true);

create index if not exists idx_audit_company on public.audit_logs(company_id, created_at desc);
create index if not exists idx_audit_dossier on public.audit_logs(dossier_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_user on public.audit_logs(user_id, created_at desc);
create index if not exists idx_audit_action on public.audit_logs(action, created_at desc);

create or replace function public.log_financial_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_json jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_json jsonb := coalesce(new_json, old_json);
  scoped_company_id uuid := nullif(row_json->>'company_id', '')::uuid;
  scoped_dossier_id uuid := nullif(row_json->>'dossier_id', '')::uuid;
  actor_id uuid := auth.uid();
  actor_email text;
  action_name text;
  fields text[];
  created_ts timestamptz := now();
begin
  if scoped_company_id is null and scoped_dossier_id is null and row_json ? 'user_id' then
    select id into scoped_company_id
    from public.companies
    where user_id = nullif(row_json->>'user_id', '')::uuid
    limit 1;
  end if;

  select email into actor_email from auth.users where id = actor_id;

  if tg_op = 'INSERT' then
    action_name := 'CREATE';
  elsif tg_op = 'UPDATE' then
    action_name := 'UPDATE';
    select array_agg(key order by key) into fields
    from (
      select key from jsonb_each(coalesce(old_json, '{}'::jsonb))
      union
      select key from jsonb_each(coalesce(new_json, '{}'::jsonb))
    ) keys
    where old_json->key is distinct from new_json->key;
  else
    action_name := 'DELETE';
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    company_id,
    dossier_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    old_values,
    new_values,
    changed_fields,
    success,
    checksum,
    created_at
  ) values (
    actor_id,
    actor_email,
    scoped_company_id,
    scoped_dossier_id,
    action_name,
    tg_table_name,
    nullif(row_json->>'id', '')::uuid,
    coalesce(
      row_json->>'invoice_number',
      row_json->>'period_label',
      row_json->>'description',
      row_json->>'name',
      row_json->>'nom'
    ),
    old_json,
    new_json,
    fields,
    true,
    encode(digest(coalesce(row_json::text, '') || tg_op || created_ts::text, 'sha256'), 'hex'),
    created_ts
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'invoices',
    'transactions',
    'tva_declarations',
    'bulletins_paie',
    'ecritures_comptables',
    'receipts',
    'avoirs_fournisseurs',
    'invoice_payments'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists %I on public.%I', table_name || '_audit_trigger', table_name);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_financial_table_change()',
        table_name || '_audit_trigger',
        table_name
      );
    end if;
  end loop;
end;
$$;

create table if not exists public.accounting_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,
  dossier_id uuid references public.dossiers,
  event_type text not null,
  triggered_by uuid references auth.users,
  triggered_by_email text,
  entity_type text,
  entity_id uuid,
  amount numeric,
  currency text default 'MAD',
  period_mois integer,
  period_annee integer,
  event_data jsonb not null,
  event_hash text,
  previous_event_id uuid references public.accounting_events,
  is_reversed boolean default false,
  reversed_by_event_id uuid references public.accounting_events,
  reversal_reason text,
  created_at timestamptz default now() not null
);

create or replace function public.prevent_accounting_events_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'accounting_events is append-only';
end;
$$;

drop trigger if exists accounting_events_append_only on public.accounting_events;
create trigger accounting_events_append_only
  before update or delete on public.accounting_events
  for each row execute function public.prevent_accounting_events_mutation();

alter table public.accounting_events enable row level security;

drop policy if exists "Read own events" on public.accounting_events;
create policy "Read own events"
  on public.accounting_events
  for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or company_id in (
      select company_id from public.user_memberships
      where user_id = auth.uid() and status = 'active'
    )
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Insert events" on public.accounting_events;
drop policy if exists "Authenticated users can insert accounting events" on public.accounting_events;
create policy "Insert events"
  on public.accounting_events
  for insert
  with check (true);

create index if not exists idx_ae_company on public.accounting_events(company_id, created_at desc);
create index if not exists idx_ae_dossier on public.accounting_events(dossier_id, created_at desc);
create index if not exists idx_ae_entity on public.accounting_events(entity_type, entity_id);
create index if not exists idx_ae_period on public.accounting_events(period_annee, period_mois);
create index if not exists idx_ae_hash on public.accounting_events(event_hash);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,
  dossier_id uuid references public.dossiers,
  mois integer not null,
  annee integer not null,
  lock_type text default 'soft',
  is_locked boolean default false,
  locked_at timestamptz,
  locked_by uuid references auth.users,
  locked_by_email text,
  lock_reason text,
  is_unlocked boolean default false,
  unlocked_at timestamptz,
  unlocked_by uuid references auth.users,
  unlock_reason text,
  triggered_by_entity text,
  triggered_by_id uuid,
  created_at timestamptz default now()
);

alter table public.accounting_periods
  add column if not exists locked_by uuid references auth.users,
  add column if not exists is_unlocked boolean default false,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references auth.users,
  add column if not exists unlock_reason text,
  add column if not exists triggered_by_entity text,
  add column if not exists triggered_by_id uuid;

create unique index if not exists idx_accounting_periods_company
  on public.accounting_periods(company_id, mois, annee)
  where company_id is not null;

create unique index if not exists idx_accounting_periods_dossier
  on public.accounting_periods(dossier_id, mois, annee)
  where dossier_id is not null;

alter table public.accounting_periods enable row level security;

drop policy if exists "Users manage scoped accounting periods" on public.accounting_periods;
drop policy if exists "Users manage own periods" on public.accounting_periods;
create policy "Users manage scoped accounting periods"
  on public.accounting_periods
  for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or company_id in (
      select company_id from public.user_memberships
      where user_id = auth.uid() and status = 'active'
    )
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or company_id in (
      select company_id from public.user_memberships
      where user_id = auth.uid() and status = 'active'
    )
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

create table if not exists public.entity_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version_number integer not null,
  changed_by uuid references auth.users,
  changed_by_email text,
  changed_at timestamptz default now(),
  change_reason text,
  change_type text,
  snapshot jsonb not null,
  diff jsonb,
  unique(entity_type, entity_id, version_number)
);

alter table public.entity_versions
  add column if not exists changed_by uuid references auth.users,
  add column if not exists change_reason text;

alter table public.entity_versions enable row level security;

drop policy if exists "Users read entity versions" on public.entity_versions;
create policy "Users read entity versions"
  on public.entity_versions
  for select
  using (
    changed_by = auth.uid()
    or exists (
      select 1 from public.companies company
      where company.user_id = auth.uid()
        and snapshot->>'company_id' = company.id::text
    )
    or exists (
      select 1 from public.user_memberships membership
      where membership.user_id = auth.uid()
        and membership.status = 'active'
        and snapshot->>'company_id' = membership.company_id::text
    )
  );

create index if not exists idx_versions_entity on public.entity_versions(entity_type, entity_id, version_number);
create index if not exists idx_versions_changed on public.entity_versions(changed_at desc);
