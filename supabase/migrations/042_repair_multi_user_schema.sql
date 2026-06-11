-- Focused compatibility repair for Mohasib team invitations.
-- Safe to run repeatedly on databases with an older user_memberships table.

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
  ('read_auditor', 'Auditeur lecture seule', 'comptable_pro', true)
on conflict (name) do nothing;

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
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists invitation_expires_at timestamptz,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists created_at timestamptz default now();

alter table public.user_memberships alter column user_id drop not null;

update public.user_memberships
set status = 'active'
where status is null or status not in ('invited', 'active', 'suspended', 'revoked');

alter table public.user_memberships
  drop constraint if exists user_memberships_status_check;

alter table public.user_memberships
  add constraint user_memberships_status_check
  check (status in ('invited', 'active', 'suspended', 'revoked'));

create unique index if not exists idx_user_memberships_company_email
  on public.user_memberships(company_id, lower(user_email))
  where company_id is not null and status <> 'revoked';

create unique index if not exists idx_user_memberships_invitation_token
  on public.user_memberships(invitation_token)
  where invitation_token is not null;

create index if not exists idx_user_memberships_user_status
  on public.user_memberships(user_id, status);

create index if not exists idx_user_memberships_company_status
  on public.user_memberships(company_id, status);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action text not null,
  label text,
  created_at timestamptz default now(),
  unique(resource, action)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_name text references public.roles(name) on delete cascade not null,
  resource text not null,
  action text not null,
  created_at timestamptz default now(),
  unique(role_name, resource, action)
);

create table if not exists public.membership_permissions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid references public.user_memberships(id) on delete cascade not null,
  resource text not null,
  action text not null,
  is_granted boolean not null,
  created_at timestamptz default now(),
  unique(membership_id, resource, action)
);

insert into public.permissions(resource, action, label) values
  ('invoice', 'read', 'Voir les factures'),
  ('invoice', 'create', 'Créer des factures'),
  ('invoice', 'update', 'Modifier les factures'),
  ('invoice', 'send', 'Envoyer les factures'),
  ('accounting', 'read', 'Voir les écritures'),
  ('accounting', 'create', 'Créer des écritures'),
  ('tva_declaration', 'read', 'Voir les déclarations TVA'),
  ('tva_declaration', 'prepare', 'Préparer les déclarations TVA'),
  ('bulletin_paie', 'read', 'Voir les bulletins'),
  ('document', 'read', 'Voir les documents'),
  ('document', 'create', 'Ajouter des documents'),
  ('settings', 'manage_team', 'Gérer l''équipe'),
  ('report', 'read', 'Consulter les rapports'),
  ('report', 'export', 'Exporter les rapports'),
  ('dossier', 'read', 'Voir les dossiers')
on conflict (resource, action) do update set label = excluded.label;

insert into public.role_permissions(role_name, resource, action)
select role_name, resource, action
from (values
  ('manager', 'invoice', 'read'), ('manager', 'invoice', 'create'),
  ('manager', 'invoice', 'update'), ('manager', 'invoice', 'send'),
  ('manager', 'accounting', 'read'), ('manager', 'accounting', 'create'),
  ('manager', 'tva_declaration', 'read'), ('manager', 'tva_declaration', 'prepare'),
  ('manager', 'bulletin_paie', 'read'), ('manager', 'document', 'read'),
  ('manager', 'document', 'create'), ('manager', 'report', 'read'),
  ('manager', 'report', 'export'),
  ('employee', 'bulletin_paie', 'read'),
  ('collaborateur', 'dossier', 'read'), ('collaborateur', 'invoice', 'read'),
  ('collaborateur', 'invoice', 'create'), ('collaborateur', 'invoice', 'update'),
  ('collaborateur', 'invoice', 'send'), ('collaborateur', 'accounting', 'read'),
  ('collaborateur', 'accounting', 'create'), ('collaborateur', 'tva_declaration', 'read'),
  ('collaborateur', 'tva_declaration', 'prepare'), ('collaborateur', 'bulletin_paie', 'read'),
  ('collaborateur', 'document', 'read'), ('collaborateur', 'document', 'create'),
  ('collaborateur', 'report', 'read'), ('collaborateur', 'report', 'export'),
  ('read_auditor', 'dossier', 'read'), ('read_auditor', 'invoice', 'read'),
  ('read_auditor', 'accounting', 'read'), ('read_auditor', 'tva_declaration', 'read'),
  ('read_auditor', 'bulletin_paie', 'read'), ('read_auditor', 'document', 'read'),
  ('read_auditor', 'report', 'read')
) as preset(role_name, resource, action)
on conflict (role_name, resource, action) do nothing;

alter table public.user_memberships enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_permissions enable row level security;

drop policy if exists "Owners manage memberships" on public.user_memberships;
create policy "Owners manage memberships" on public.user_memberships
  for all
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));

drop policy if exists "Users read own memberships" on public.user_memberships;
create policy "Users read own memberships" on public.user_memberships
  for select
  using (
    user_id = auth.uid()
    or company_id in (select id from public.companies where user_id = auth.uid())
  );

drop policy if exists "Authenticated users read permissions" on public.permissions;
create policy "Authenticated users read permissions" on public.permissions
  for select to authenticated using (true);

drop policy if exists "Authenticated users read role permissions" on public.role_permissions;
create policy "Authenticated users read role permissions" on public.role_permissions
  for select to authenticated using (true);

drop policy if exists "Members read own overrides" on public.membership_permissions;
create policy "Members read own overrides" on public.membership_permissions
  for select
  using (membership_id in (select id from public.user_memberships where user_id = auth.uid()));

notify pgrst, 'reload schema';
