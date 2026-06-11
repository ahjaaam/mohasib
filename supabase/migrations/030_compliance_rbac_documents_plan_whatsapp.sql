-- Audit and compliance foundations.
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
  checksum text,
  created_at timestamptz default now() not null
);

alter table public.audit_logs enable row level security;

drop policy if exists "Users can read scoped audit logs" on public.audit_logs;
create policy "Users can read scoped audit logs"
  on public.audit_logs
  for select
  using (
    user_id = auth.uid()
    or company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users can insert scoped audit logs" on public.audit_logs;
create policy "Users can insert scoped audit logs"
  on public.audit_logs
  for insert
  with check (
    user_id = auth.uid()
    or company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,
  dossier_id uuid references public.dossiers,
  mois integer not null,
  annee integer not null,
  lock_type text default 'soft',
  is_locked boolean default false,
  locked_at timestamptz,
  locked_by_email text,
  lock_reason text,
  created_at timestamptz default now(),
  constraint chk_accounting_period_scope check (
    (company_id is not null and dossier_id is null)
    or
    (company_id is null and dossier_id is not null)
  )
);

create unique index if not exists idx_accounting_periods_company
  on public.accounting_periods(company_id, mois, annee)
  where company_id is not null;

create unique index if not exists idx_accounting_periods_dossier
  on public.accounting_periods(dossier_id, mois, annee)
  where dossier_id is not null;

alter table public.accounting_periods enable row level security;

drop policy if exists "Users manage scoped accounting periods" on public.accounting_periods;
create policy "Users manage scoped accounting periods"
  on public.accounting_periods
  for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

create table if not exists public.entity_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version_number integer not null,
  changed_by_email text,
  changed_at timestamptz default now(),
  change_type text,
  snapshot jsonb not null,
  diff jsonb,
  unique(entity_type, entity_id, version_number)
);

alter table public.entity_versions enable row level security;

-- RBAC foundations.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text not null,
  track text not null,
  is_system boolean default false
);

insert into public.roles (name, label, track, is_system) values
  ('owner', 'Propriétaire', 'business', true),
  ('manager', 'Responsable', 'business', true),
  ('employee', 'Employé', 'business', true),
  ('cabinet_owner', 'Propriétaire cabinet', 'comptable_pro', true),
  ('collaborateur', 'Collaborateur cabinet', 'comptable_pro', true),
  ('read_auditor', 'Auditeur lecture seule', 'comptable_pro', true),
  ('client_portal', 'Client (portail)', 'comptable_pro', true)
on conflict (name) do nothing;

create table if not exists public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  user_email text,
  company_id uuid references public.companies,
  dossier_id uuid references public.dossiers,
  role_name text references public.roles(name) not null,
  dossier_scope uuid[],
  status text default 'active',
  invitation_token text unique,
  employee_id uuid references public.employees,
  created_at timestamptz default now()
);

-- Repair older/partial versions of user_memberships before policies reference
-- columns that CREATE TABLE IF NOT EXISTS cannot add.
alter table public.user_memberships
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists user_email text,
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists dossier_id uuid references public.dossiers(id) on delete cascade,
  add column if not exists role_name text references public.roles(name),
  add column if not exists dossier_scope uuid[],
  add column if not exists status text default 'active',
  add column if not exists invitation_token text,
  add column if not exists employee_id uuid references public.employees(id) on delete set null,
  add column if not exists created_at timestamptz default now();

alter table public.user_memberships enable row level security;

drop policy if exists "Users read own memberships" on public.user_memberships;
create policy "Users read own memberships"
  on public.user_memberships
  for select
  using (
    user_id = auth.uid()
    or company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

-- Unified document management layer.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,
  dossier_id uuid references public.dossiers,
  document_number text unique,
  document_type text not null,
  document_category text,
  source text not null,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_hash text,
  extracted_data jsonb,
  extraction_confidence numeric,
  document_date date,
  due_date date,
  period_mois integer,
  period_annee integer,
  amount_ht numeric,
  amount_tva numeric,
  amount_ttc numeric,
  counterpart_name text,
  retention_years integer default 10,
  is_archived boolean default false,
  status text default 'active',
  created_at timestamptz default now(),
  constraint chk_documents_scope check (
    (company_id is not null and dossier_id is null)
    or
    (company_id is null and dossier_id is not null)
  )
);

create index if not exists idx_documents_company on public.documents(company_id, created_at desc);
create index if not exists idx_documents_dossier on public.documents(dossier_id, created_at desc);
create index if not exists idx_documents_hash on public.documents(file_hash);

alter table public.documents enable row level security;

drop policy if exists "Users manage scoped documents" on public.documents;
create policy "Users manage scoped documents"
  on public.documents
  for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents not null,
  invoice_id uuid references public.invoices,
  transaction_id uuid references public.transactions,
  tva_declaration_id uuid references public.tva_declarations,
  bulletin_paie_id uuid references public.bulletins_paie,
  ecriture_id uuid references public.ecritures_comptables,
  employee_id uuid references public.employees,
  link_type text not null,
  created_at timestamptz default now()
);

create index if not exists idx_document_links_document on public.document_links(document_id);

alter table public.document_links enable row level security;

drop policy if exists "Users manage scoped document links" on public.document_links;
create policy "Users manage scoped document links"
  on public.document_links
  for all
  using (
    document_id in (
      select id from public.documents
      where company_id in (select id from public.companies where user_id = auth.uid())
         or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    )
  )
  with check (
    document_id in (
      select id from public.documents
      where company_id in (select id from public.companies where user_id = auth.uid())
         or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    )
  );

-- Plan enforcement foundations.
create table if not exists public.plan_limits (
  plan text primary key,
  label text,
  price_monthly integer,
  ocr_limit integer default 50,
  storage_gb integer default 5,
  dossiers_limit integer default 0,
  users_limit integer default 1,
  has_bank_import boolean default false,
  has_saisie boolean default false,
  has_paie boolean default false,
  has_export_fiduciaire boolean default false,
  has_avoirs boolean default false,
  has_bilan boolean default false,
  has_mass_declarations boolean default false,
  has_whatsapp_agent boolean default false
);

insert into public.plan_limits values
  ('trial', 'Essai', 0, 50, 5, 0, 1, true, true, true, true, true, false, false, false),
  ('starter', 'Starter', 99, 50, 5, 0, 1, false, false, false, false, false, false, false, false),
  ('business', 'Business', 229, 250, 25, 0, 1, true, true, true, true, true, false, false, false),
  ('business_pro', 'Business Pro', 449, -1, -1, 0, 3, true, true, true, true, true, true, false, true),
  ('comptable_s', 'Comptable Pro Starter', 299, 100, 25, 5, 1, true, true, true, true, true, true, false, false),
  ('comptable_pro', 'Comptable Pro', 599, 500, 100, 20, 2, true, true, true, true, true, true, true, false),
  ('comptable_inf', 'Comptable Pro Illimité', 999, -1, -1, -1, 5, true, true, true, true, true, true, true, false)
on conflict (plan) do nothing;

alter table public.companies
  add column if not exists plan text default 'trial',
  add column if not exists trial_ends_at timestamptz default (now() + interval '7 days'),
  add column if not exists ocr_used_this_month integer default 0;

-- WhatsApp AI agent foundation.
create table if not exists public.whatsapp_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,
  whatsapp_phone text unique not null,
  is_verified boolean default false,
  verification_code text,
  last_message_at timestamptz,
  conversation_history jsonb default '[]',
  messages_today integer default 0,
  created_at timestamptz default now()
);

alter table public.whatsapp_users enable row level security;

drop policy if exists "Users manage own whatsapp users" on public.whatsapp_users;
create policy "Users manage own whatsapp users"
  on public.whatsapp_users
  for all
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
