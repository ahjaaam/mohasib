-- Companies table
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  raison_sociale text,
  forme_juridique text,
  ice text,
  if_number text,
  rc text,
  cnss text,
  patente text,
  capital_social numeric,
  address text,
  city text,
  postal_code text,
  country text default 'Maroc',
  phone text,
  email text,
  website text,
  whatsapp text,
  logo_url text,
  tva_assujetti boolean default true,
  tva_taux_defaut numeric default 20,
  tva_regime text default 'Mensuel',
  invoice_prefix text default 'F-',
  invoice_payment_delay text default '30 jours',
  invoice_mentions_legales text,
  bank_name text,
  rib text,
  iban text,
  invoice_template text default 'classique',
  invoice_color text default '#C8924A',
  invoice_font text default 'Classique',
  show_logo boolean default true,
  show_cnss boolean default true,
  show_capital boolean default false,
  show_rib boolean default true,
  show_mentions boolean default true,
  show_page_number boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.companies enable row level security;

create policy "Users manage own company"
  on public.companies
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User preferences table
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  notif_tva_email boolean default true,
  notif_overdue_email boolean default true,
  notif_weekly_summary boolean default true,
  notif_whatsapp boolean default false,
  language text default 'fr',
  timezone text default 'Africa/Casablanca',
  date_format text default 'DD/MM/YYYY',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "Users manage own preferences"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fiduciaire waitlist table
create table if not exists public.fiduciaire_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  created_at timestamptz default now()
);

alter table public.fiduciaire_waitlist enable row level security;

create policy "Users insert own waitlist entry"
  on public.fiduciaire_waitlist
  for insert
  with check (auth.uid() = user_id);
