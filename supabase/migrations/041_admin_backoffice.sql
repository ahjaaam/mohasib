-- Founder admin back office: subscriptions, limits, requests, and account state.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  plan text not null,
  previous_plan text,
  change_type text,
  billing_period text default 'monthly',
  amount_mad numeric default 0,
  payment_method text,
  payment_reference text,
  starts_at date not null,
  ends_at date not null,
  status text default 'active',
  notes text,
  created_by_email text,
  created_at timestamptz default now()
);

create table if not exists public.company_limit_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null unique,
  ocr_limit integer,
  storage_gb integer,
  dossiers_limit integer,
  users_limit integer,
  has_paie boolean,
  has_bank_import boolean,
  has_saisie boolean,
  has_export_fiduciaire boolean,
  has_avoirs boolean,
  has_bilan boolean,
  has_mass_declarations boolean,
  has_whatsapp_agent boolean,
  reason text,
  expires_at date,
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  current_plan text,
  requested_plan text,
  requested_period text default 'monthly',
  status text default 'nouveau',
  created_at timestamptz default now()
);

create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text,
  email text not null,
  phone text,
  message text,
  status text default 'nouveau',
  created_at timestamptz default now()
);

alter table public.companies
  add column if not exists subscription_ends_at date,
  add column if not exists subscription_status text default 'trial',
  add column if not exists scheduled_plan text,
  add column if not exists scheduled_plan_date date,
  add column if not exists is_suspended boolean default false,
  add column if not exists suspended_reason text,
  add column if not exists admin_notes text;

alter table public.subscriptions enable row level security;
alter table public.company_limit_overrides enable row level security;
alter table public.upgrade_requests enable row level security;
alter table public.custom_requests enable row level security;

create index if not exists idx_subscriptions_company_created on public.subscriptions(company_id, created_at desc);
create index if not exists idx_subscriptions_status_ends on public.subscriptions(status, ends_at);
create index if not exists idx_upgrade_requests_status on public.upgrade_requests(status, created_at desc);

-- Users can request an upgrade and read their own active override/subscription state.
drop policy if exists "Owners create upgrade requests" on public.upgrade_requests;
create policy "Owners create upgrade requests" on public.upgrade_requests for insert
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
drop policy if exists "Owners read own upgrades" on public.upgrade_requests;
create policy "Owners read own upgrades" on public.upgrade_requests for select
  using (company_id in (select id from public.companies where user_id = auth.uid()));
drop policy if exists "Owners read own subscriptions" on public.subscriptions;
create policy "Owners read own subscriptions" on public.subscriptions for select
  using (company_id in (select id from public.companies where user_id = auth.uid()));
drop policy if exists "Owners read own limit overrides" on public.company_limit_overrides;
create policy "Owners read own limit overrides" on public.company_limit_overrides for select
  using (company_id in (select id from public.companies where user_id = auth.uid()));
