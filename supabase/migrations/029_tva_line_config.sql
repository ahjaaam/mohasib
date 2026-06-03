create table if not exists public.tva_line_config (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  period text,
  line_code integer not null,
  is_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chk_tva_line_config_isolation check (
    (company_id is not null and dossier_id is null)
    or
    (company_id is null and dossier_id is not null)
  )
);

create unique index if not exists idx_tva_line_config_unique
  on public.tva_line_config (
    coalesce(company_id::text, ''),
    coalesce(dossier_id::text, ''),
    coalesce(period, '__global__'),
    line_code
  );

create index if not exists idx_tva_line_config_company on public.tva_line_config(company_id, period);
create index if not exists idx_tva_line_config_dossier on public.tva_line_config(dossier_id, period);

alter table public.tva_line_config enable row level security;

drop policy if exists "tva line config owner" on public.tva_line_config;
create policy "tva line config owner"
  on public.tva_line_config
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
