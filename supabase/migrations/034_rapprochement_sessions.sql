-- Rapprochement bancaire sessions and line-level workspace state.

create table if not exists public.rapprochement_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  periode_debut date not null,
  periode_fin date not null,
  solde_initial_banque numeric default 0,
  solde_final_banque numeric default 0,
  solde_initial_comptable numeric default 0,
  solde_final_comptable numeric default 0,
  ecart numeric default 0,
  is_balanced boolean default false,
  statut text default 'en_cours',
  validated_at timestamptz,
  created_at timestamptz default now(),
  constraint chk_rapprochement_session_scope check (
    (company_id is not null and dossier_id is null)
    or
    (company_id is null and dossier_id is not null)
  )
);

create table if not exists public.rapprochement_lignes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.rapprochement_sessions(id) on delete cascade,
  bank_line_id uuid references public.bank_statement_lines(id) on delete set null,
  bank_date date,
  bank_description text,
  bank_amount numeric,
  bank_reference text,
  ecriture_id uuid references public.ecritures_comptables(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  inbox_item_id uuid,
  statut text default 'non_rapproché',
  match_confidence numeric default 0,
  match_method text,
  matched_at timestamptz,
  matched_by text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_rapprochement_sessions_company on public.rapprochement_sessions(company_id, created_at desc);
create index if not exists idx_rapprochement_sessions_dossier on public.rapprochement_sessions(dossier_id, created_at desc);
create index if not exists idx_rapprochement_lignes_session on public.rapprochement_lignes(session_id, statut);
create index if not exists idx_rapprochement_lignes_ecriture on public.rapprochement_lignes(ecriture_id);

alter table public.rapprochement_sessions enable row level security;
alter table public.rapprochement_lignes enable row level security;

drop policy if exists "Users manage own rapprochement sessions" on public.rapprochement_sessions;
create policy "Users manage own rapprochement sessions"
  on public.rapprochement_sessions
  for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or
    dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or
    dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "Users manage own rapprochement lignes" on public.rapprochement_lignes;
create policy "Users manage own rapprochement lignes"
  on public.rapprochement_lignes
  for all
  using (
    session_id in (
      select id from public.rapprochement_sessions
      where company_id in (select id from public.companies where user_id = auth.uid())
         or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    )
  )
  with check (
    session_id in (
      select id from public.rapprochement_sessions
      where company_id in (select id from public.companies where user_id = auth.uid())
         or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    )
  );
