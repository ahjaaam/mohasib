-- Reusable quote setups (client, quote details, conditions, and line items).

create table if not exists public.devis_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  objet text,
  validity_days integer not null default 30 check (validity_days between 1 and 365),
  conditions text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_devis_templates_owner
  on public.devis_templates(user_id, dossier_id, created_at desc);

alter table public.devis_templates enable row level security;

drop policy if exists "Members read devis templates" on public.devis_templates;
create policy "Members read devis templates"
  on public.devis_templates for select
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'read', user_id, dossier_id)
  );

drop policy if exists "Members create devis templates" on public.devis_templates;
create policy "Members create devis templates"
  on public.devis_templates for insert
  with check (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'create', user_id, dossier_id)
  );

drop policy if exists "Members update devis templates" on public.devis_templates;
create policy "Members update devis templates"
  on public.devis_templates for update
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'update', user_id, dossier_id)
  )
  with check (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'update', user_id, dossier_id)
  );

drop policy if exists "Members delete devis templates" on public.devis_templates;
create policy "Members delete devis templates"
  on public.devis_templates for delete
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'delete', user_id, dossier_id)
  );
