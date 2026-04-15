-- ── Payroll module ─────────────────────────────────────────────────────────

create table if not exists public.employees (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies(id),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- Identity
  nom              text not null,
  prenom           text not null,
  cin              text,
  date_naissance   date,
  date_embauche    date not null,
  poste            text,
  departement      text,
  -- Contract
  type_contrat     text default 'CDI',  -- CDI, CDD, Anapec, Intérim
  salaire_brut     numeric not null,
  -- Fiscal
  situation_familiale text default 'Célibataire',
  nombre_enfants   integer default 0,
  -- Bank
  banque           text,
  rib              text,
  -- CNSS
  numero_cnss      text,
  -- Status
  statut           text default 'actif', -- actif, inactif, suspendu
  created_at       timestamptz default now()
);

create table if not exists public.bulletins_paie (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies(id),
  employee_id      uuid not null references public.employees(id) on delete cascade,
  -- Period
  mois             integer not null,
  annee            integer not null,
  period_label     text,
  -- Gross
  salaire_brut     numeric not null,
  heures_sup       numeric default 0,
  primes           numeric default 0,
  indemnites       numeric default 0,
  -- Employee deductions
  cnss_salarie     numeric not null,
  amo_salarie      numeric not null,
  frais_pro        numeric not null default 0,
  -- Net imposable
  salaire_net_imposable numeric not null,
  -- IR
  ir_brut          numeric not null,
  deduction_charge_famille numeric default 0,
  ir_net           numeric not null,
  -- Net to pay
  salaire_net_payer numeric not null,
  -- Employer charges
  cnss_patronal    numeric not null,
  amo_patronal     numeric not null,
  taxe_formation_pro numeric not null,
  cout_total_employeur numeric not null,
  -- Status
  statut           text default 'brouillon', -- brouillon, validé, payé
  paid_at          timestamptz,
  pdf_url          text,
  created_at       timestamptz default now(),
  unique(employee_id, mois, annee)
);

alter table public.employees enable row level security;

create policy "Users manage own employees"
  on public.employees for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.bulletins_paie enable row level security;

create policy "Users manage own bulletins"
  on public.bulletins_paie for all
  using  (employee_id in (select id from public.employees where user_id = auth.uid()))
  with check (employee_id in (select id from public.employees where user_id = auth.uid()));

create index if not exists idx_employees_user_id
  on public.employees(user_id, statut);

create index if not exists idx_bulletins_employee_period
  on public.bulletins_paie(employee_id, annee desc, mois desc);
