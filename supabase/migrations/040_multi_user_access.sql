-- Multi-user invitations, role presets, and per-member permission overrides.

-- Compatibility bootstrap for databases where user_memberships existed before
-- migration 030. CREATE TABLE IF NOT EXISTS does not add missing columns to an
-- existing table, so add every base column used below before creating policies.
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

alter table public.user_memberships
  alter column user_id drop not null,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists invitation_expires_at timestamptz,
  add column if not exists first_name text,
  add column if not exists last_name text;

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
  ('invoice', 'delete', 'Supprimer les factures'),
  ('invoice', 'send', 'Envoyer les factures'),
  ('accounting', 'read', 'Voir les écritures'),
  ('accounting', 'create', 'Créer des écritures'),
  ('accounting', 'delete', 'Supprimer des écritures'),
  ('accounting', 'lock', 'Verrouiller les périodes'),
  ('tva_declaration', 'read', 'Voir les déclarations TVA'),
  ('tva_declaration', 'prepare', 'Préparer les déclarations TVA'),
  ('tva_declaration', 'validate', 'Valider les déclarations TVA'),
  ('bulletin_paie', 'read', 'Voir les bulletins'),
  ('bulletin_paie', 'validate', 'Valider les bulletins'),
  ('salary', 'read', 'Voir les salaires'),
  ('document', 'read', 'Voir les documents'),
  ('document', 'create', 'Ajouter des documents'),
  ('document', 'delete', 'Supprimer des documents'),
  ('settings', 'update', 'Modifier les paramètres'),
  ('settings', 'manage_team', 'Gérer l''équipe'),
  ('report', 'read', 'Consulter les rapports'),
  ('report', 'export', 'Exporter les rapports'),
  ('dossier', 'read', 'Voir les dossiers')
on conflict (resource, action) do update set label = excluded.label;

insert into public.role_permissions(role_name, resource, action)
select role_name, resource, action
from (values
  ('manager', 'invoice', 'read'), ('manager', 'invoice', 'create'), ('manager', 'invoice', 'update'), ('manager', 'invoice', 'send'),
  ('manager', 'accounting', 'read'), ('manager', 'accounting', 'create'),
  ('manager', 'tva_declaration', 'read'), ('manager', 'tva_declaration', 'prepare'),
  ('manager', 'bulletin_paie', 'read'), ('manager', 'document', 'read'), ('manager', 'document', 'create'),
  ('manager', 'report', 'read'), ('manager', 'report', 'export'),
  ('employee', 'bulletin_paie', 'read'),
  ('collaborateur', 'dossier', 'read'), ('collaborateur', 'invoice', 'read'), ('collaborateur', 'invoice', 'create'),
  ('collaborateur', 'invoice', 'update'), ('collaborateur', 'invoice', 'send'),
  ('collaborateur', 'accounting', 'read'), ('collaborateur', 'accounting', 'create'),
  ('collaborateur', 'tva_declaration', 'read'), ('collaborateur', 'tva_declaration', 'prepare'),
  ('collaborateur', 'bulletin_paie', 'read'), ('collaborateur', 'document', 'read'), ('collaborateur', 'document', 'create'),
  ('collaborateur', 'report', 'read'), ('collaborateur', 'report', 'export'),
  ('read_auditor', 'dossier', 'read'), ('read_auditor', 'invoice', 'read'), ('read_auditor', 'accounting', 'read'),
  ('read_auditor', 'tva_declaration', 'read'), ('read_auditor', 'bulletin_paie', 'read'),
  ('read_auditor', 'document', 'read'), ('read_auditor', 'report', 'read')
) as preset(role_name, resource, action)
on conflict (role_name, resource, action) do nothing;

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_permissions enable row level security;

drop policy if exists "Authenticated users read permissions" on public.permissions;
create policy "Authenticated users read permissions" on public.permissions
  for select to authenticated using (true);

drop policy if exists "Authenticated users read role permissions" on public.role_permissions;
create policy "Authenticated users read role permissions" on public.role_permissions
  for select to authenticated using (true);

drop policy if exists "Members read own overrides" on public.membership_permissions;
create policy "Members read own overrides" on public.membership_permissions
  for select using (
    membership_id in (select id from public.user_memberships where user_id = auth.uid())
  );

drop policy if exists "Owners manage overrides" on public.membership_permissions;
create policy "Owners manage overrides" on public.membership_permissions
  for all using (
    membership_id in (
      select id from public.user_memberships
      where company_id in (select id from public.companies where user_id = auth.uid())
         or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    )
  )
  with check (
    membership_id in (
      select id from public.user_memberships
      where company_id in (select id from public.companies where user_id = auth.uid())
         or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
    )
  );

drop policy if exists "Owners manage memberships" on public.user_memberships;
create policy "Owners manage memberships" on public.user_memberships
  for all using (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

create index if not exists idx_user_memberships_user_status on public.user_memberships(user_id, status);
create index if not exists idx_user_memberships_company_status on public.user_memberships(company_id, status);
create index if not exists idx_membership_permissions_membership on public.membership_permissions(membership_id);

-- Permission-aware RLS helper used by direct Supabase queries in the application.
create or replace function public.member_has_permission(
  requested_resource text,
  requested_action text,
  owner_user_id uuid,
  requested_dossier_id uuid default null
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and (
        (
          requested_dossier_id is null
          and membership.company_id in (select id from public.companies where user_id = owner_user_id)
        )
        or (
          requested_dossier_id is not null
          and (
            membership.dossier_id = requested_dossier_id
            or membership.dossier_scope is null
            or requested_dossier_id = any(membership.dossier_scope)
          )
        )
      )
      and coalesce(
        (
          select override.is_granted
          from public.membership_permissions override
          where override.membership_id = membership.id
            and override.resource = requested_resource
            and override.action = requested_action
        ),
        exists (
          select 1 from public.role_permissions preset
          where preset.role_name = membership.role_name
            and preset.resource = requested_resource
            and preset.action = requested_action
        )
      )
  );
$$;

drop policy if exists "Members read company" on public.companies;
create policy "Members read company" on public.companies for select
  using (public.member_has_permission('report', 'read', user_id));

drop policy if exists "Members read cabinet" on public.cabinets;
create policy "Members read cabinet" on public.cabinets for select
  using (public.member_has_permission('dossier', 'read', user_id));

drop policy if exists "Members read dossiers" on public.dossiers;
create policy "Members read dossiers" on public.dossiers for select
  using (public.member_has_permission('dossier', 'read', fiduciaire_user_id, id));

drop policy if exists "Members read invoices" on public.invoices;
create policy "Members read invoices" on public.invoices for select
  using (public.member_has_permission('invoice', 'read', user_id, dossier_id));
drop policy if exists "Members create invoices" on public.invoices;
create policy "Members create invoices" on public.invoices for insert
  with check (public.member_has_permission('invoice', 'create', user_id, dossier_id));
drop policy if exists "Members update invoices" on public.invoices;
create policy "Members update invoices" on public.invoices for update
  using (public.member_has_permission('invoice', 'update', user_id, dossier_id))
  with check (public.member_has_permission('invoice', 'update', user_id, dossier_id));
drop policy if exists "Members delete invoices" on public.invoices;
create policy "Members delete invoices" on public.invoices for delete
  using (public.member_has_permission('invoice', 'delete', user_id, dossier_id));

drop policy if exists "Members read clients" on public.clients;
create policy "Members read clients" on public.clients for select
  using (public.member_has_permission('invoice', 'read', user_id, dossier_id));
drop policy if exists "Members manage clients" on public.clients;
create policy "Members manage clients" on public.clients for all
  using (public.member_has_permission('invoice', 'update', user_id, dossier_id))
  with check (public.member_has_permission('invoice', 'create', user_id, dossier_id));

drop policy if exists "Members read transactions" on public.transactions;
create policy "Members read transactions" on public.transactions for select
  using (public.member_has_permission('accounting', 'read', user_id, dossier_id));
drop policy if exists "Members manage transactions" on public.transactions;
create policy "Members manage transactions" on public.transactions for all
  using (public.member_has_permission('accounting', 'create', user_id, dossier_id))
  with check (public.member_has_permission('accounting', 'create', user_id, dossier_id));

drop policy if exists "Members read receipts" on public.receipts;
create policy "Members read receipts" on public.receipts for select
  using (public.member_has_permission('document', 'read', user_id, dossier_id));
drop policy if exists "Members manage receipts" on public.receipts;
create policy "Members manage receipts" on public.receipts for all
  using (public.member_has_permission('document', 'create', user_id, dossier_id))
  with check (public.member_has_permission('document', 'create', user_id, dossier_id));

drop policy if exists "Members read employees" on public.employees;
create policy "Members read employees" on public.employees for select
  using (
    public.member_has_permission('bulletin_paie', 'read', user_id, dossier_id)
    and exists (
      select 1 from public.user_memberships membership
      where membership.user_id = auth.uid()
        and membership.status = 'active'
        and (membership.employee_id is null or membership.employee_id = employees.id)
    )
  );

drop policy if exists "Members read bulletins" on public.bulletins_paie;
create policy "Members read bulletins" on public.bulletins_paie for select
  using (
    exists (
      select 1 from public.user_memberships membership
      where membership.user_id = auth.uid()
        and membership.status = 'active'
        and (membership.employee_id is null or membership.employee_id = bulletins_paie.employee_id)
        and (
          company_id = membership.company_id
          or dossier_id = membership.dossier_id
          or dossier_id = any(coalesce(membership.dossier_scope, '{}'::uuid[]))
        )
        and public.member_has_permission('bulletin_paie', 'read',
          coalesce(
            (select user_id from public.companies where id = bulletins_paie.company_id),
            (select fiduciaire_user_id from public.dossiers where id = bulletins_paie.dossier_id)
          ),
          bulletins_paie.dossier_id
        )
    )
  );

drop policy if exists "Members read dossier entries" on public.dossier_ecritures;
create policy "Members read dossier entries" on public.dossier_ecritures for select
  using (public.member_has_permission('accounting', 'read', fiduciaire_user_id, dossier_id));
drop policy if exists "Members manage dossier entries" on public.dossier_ecritures;
create policy "Members manage dossier entries" on public.dossier_ecritures for all
  using (public.member_has_permission('accounting', 'create', fiduciaire_user_id, dossier_id))
  with check (public.member_has_permission('accounting', 'create', fiduciaire_user_id, dossier_id));

drop policy if exists "Members read dossier tva" on public.dossier_tva;
create policy "Members read dossier tva" on public.dossier_tva for select
  using (public.member_has_permission('tva_declaration', 'read', fiduciaire_user_id, dossier_id));

-- Ask PostgREST to refresh its column cache immediately after the migration.
notify pgrst, 'reload schema';
