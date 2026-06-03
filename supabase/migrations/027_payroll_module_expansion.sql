-- Complete but simple Moroccan payroll module expansion.
-- Keeps existing payroll columns intact and adds the missing operational tables.

alter table public.employees
  add column if not exists matricule text,
  add column if not exists cnss_number text,
  add column if not exists date_fin_contrat date,
  add column if not exists salaire_base numeric not null default 0,
  add column if not exists mode_paiement text default 'virement',
  add column if not exists heures_travail_semaine numeric default 44,
  add column if not exists jours_travail_semaine numeric default 6,
  add column if not exists is_active boolean default true,
  add column if not exists notes text;

update public.employees
set salaire_base = coalesce(nullif(salaire_base, 0), salaire_brut, 0)
where salaire_base = 0;

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  document_type text not null,
  document_name text not null,
  file_url text not null,
  file_name text,
  file_size integer,
  date_emission date,
  date_expiration date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  name text not null,
  code text,
  is_paid boolean default true,
  days_per_year numeric,
  color text default '#C8924A',
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.employee_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  leave_type_id uuid references public.leave_types(id) on delete set null,
  date_debut date not null,
  date_fin date not null,
  nombre_jours numeric not null,
  statut text default 'approuvé',
  is_paid boolean default true,
  impact_salaire numeric default 0,
  justificatif_url text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.jours_feries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  name_ar text,
  is_national boolean default true,
  created_at timestamptz default now()
);

insert into public.jours_feries (date, name, name_ar) values
('2026-01-01', 'Nouvel An', 'رأس السنة الميلادية'),
('2026-01-11', 'Manifeste de l''Indépendance', 'تقديم وثيقة الاستقلال'),
('2026-05-01', 'Fête du Travail', 'عيد الشغل'),
('2026-07-30', 'Fête du Trône', 'عيد العرش'),
('2026-08-14', 'Allégeance Oued Eddahab', 'ذكرى استرجاع إقليم وادي الذهب'),
('2026-08-20', 'Révolution du Roi et du Peuple', 'ذكرى ثورة الملك والشعب'),
('2026-08-21', 'Fête de la Jeunesse', 'عيد الشباب'),
('2026-11-06', 'Marche Verte', 'ذكرى المسيرة الخضراء'),
('2026-11-18', 'Fête de l''Indépendance', 'عيد الاستقلال')
on conflict (date) do nothing;

create table if not exists public.employee_heures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  mois integer not null,
  annee integer not null,
  heures_normales numeric default 0,
  heures_theoriques numeric default 0,
  heures_sup_25 numeric default 0,
  heures_sup_50 numeric default 0,
  heures_sup_100 numeric default 0,
  jours_absence numeric default 0,
  heures_absence numeric default 0,
  montant_heures_sup numeric default 0,
  montant_absence_deduit numeric default 0,
  notes text,
  unique(employee_id, mois, annee)
);

create table if not exists public.employee_primes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  bulletin_id uuid references public.bulletins_paie(id) on delete set null,
  mois integer,
  annee integer,
  prime_type text not null,
  label text not null,
  montant numeric not null,
  is_imposable boolean default true,
  is_soumis_cnss boolean default false,
  created_at timestamptz default now()
);

alter table public.bulletins_paie
  add column if not exists date_paiement date,
  add column if not exists mode_paiement text,
  add column if not exists salaire_base numeric default 0,
  add column if not exists heures_theoriques numeric default 191.33,
  add column if not exists heures_travaillees numeric default 191.33,
  add column if not exists taux_horaire numeric default 0,
  add column if not exists heures_sup_25 numeric default 0,
  add column if not exists montant_sup_25 numeric default 0,
  add column if not exists heures_sup_50 numeric default 0,
  add column if not exists montant_sup_50 numeric default 0,
  add column if not exists heures_sup_100 numeric default 0,
  add column if not exists montant_sup_100 numeric default 0,
  add column if not exists jours_absence numeric default 0,
  add column if not exists montant_absence_deduit numeric default 0,
  add column if not exists jours_conge_pris numeric default 0,
  add column if not exists total_primes numeric default 0,
  add column if not exists total_indemnites numeric default 0,
  add column if not exists base_cnss numeric default 0,
  add column if not exists plafond_cnss numeric default 6000,
  add column if not exists net_imposable numeric default 0,
  add column if not exists deduction_familiale numeric default 0,
  add column if not exists ir_net numeric default 0,
  add column if not exists net_a_payer numeric default 0,
  add column if not exists cout_employeur numeric default 0,
  add column if not exists notes text;

create table if not exists public.employee_leave_balance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  annee integer not null,
  conge_acquis numeric default 0,
  conge_pris numeric default 0,
  conge_restant numeric generated always as (conge_acquis - conge_pris) stored,
  updated_at timestamptz default now(),
  unique(employee_id, annee)
);

alter table public.employee_documents enable row level security;
alter table public.leave_types enable row level security;
alter table public.employee_leaves enable row level security;
alter table public.employee_heures enable row level security;
alter table public.employee_primes enable row level security;
alter table public.employee_leave_balance enable row level security;

drop policy if exists "Users manage own employee documents" on public.employee_documents;
create policy "Users manage own employee documents" on public.employee_documents
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users manage own leave types" on public.leave_types;
create policy "Users manage own leave types" on public.leave_types
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    or is_default = true
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    or is_default = true
  );

drop policy if exists "Users manage own employee leaves" on public.employee_leaves;
create policy "Users manage own employee leaves" on public.employee_leaves
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users manage own employee hours" on public.employee_heures;
create policy "Users manage own employee hours" on public.employee_heures
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users manage own employee primes" on public.employee_primes;
create policy "Users manage own employee primes" on public.employee_primes
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users manage own leave balances" on public.employee_leave_balance;
create policy "Users manage own leave balances" on public.employee_leave_balance
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

create index if not exists idx_employee_documents_employee on public.employee_documents(employee_id, created_at desc);
create index if not exists idx_employee_leaves_scope on public.employee_leaves(company_id, dossier_id, date_debut desc);
create index if not exists idx_employee_heures_scope on public.employee_heures(company_id, dossier_id, annee desc, mois desc);
create index if not exists idx_employee_primes_scope on public.employee_primes(company_id, dossier_id, annee desc, mois desc);
