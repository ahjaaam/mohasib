-- Company collaborators share the owner's data and full functional access.
-- The internal role key remains "manager" for backwards compatibility.

update public.roles
set label = 'Collaborateur'
where name = 'manager';

update public.user_memberships
set role_name = 'manager',
    dossier_scope = null
where company_id is not null
  and role_name in ('employee', 'collaborateur', 'read_auditor');

-- Production databases that were created before dossier support can be
-- missing one or more of these columns even though newer policies rely on
-- them. Repair only tables that already exist, without disturbing data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_memberships',
    'invoices',
    'clients',
    'transactions',
    'receipts',
    'company_documents',
    'employees',
    'bulletins_paie'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'alter table public.%I add column if not exists dossier_id uuid',
        table_name
      );
    end if;
  end loop;
end
$$;

-- Repair databases where the invitation/membership migration completed only
-- partially and the granular permission tables were never created.
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
  role_name text not null,
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

-- Older partial schemas can contain foreign keys pointing at an empty or
-- incompletely repaired permission catalog. Rebuild them after seeding.
alter table public.role_permissions
  drop constraint if exists role_permissions_resource_action_fkey;
alter table public.membership_permissions
  drop constraint if exists membership_permissions_resource_action_fkey;

create unique index if not exists idx_permissions_resource_action
  on public.permissions(resource, action);
create index if not exists idx_membership_permissions_membership
  on public.membership_permissions(membership_id);

insert into public.permissions(resource, action, label) values
  ('invoice', 'read', 'Voir les factures'),
  ('invoice', 'create', 'Créer des factures'),
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
select 'manager', resource, action
from public.permissions
on conflict (role_name, resource, action) do nothing;

-- Remove legacy per-member restrictions. Collaborators now always have full
-- access to their company's shared account.
delete from public.membership_permissions
where membership_id in (
  select id from public.user_memberships where role_name = 'manager'
);

alter table public.role_permissions
  add constraint role_permissions_resource_action_fkey
  foreign key (resource, action)
  references public.permissions(resource, action)
  on delete cascade;

alter table public.membership_permissions
  add constraint membership_permissions_resource_action_fkey
  foreign key (resource, action)
  references public.permissions(resource, action)
  on delete cascade;

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_permissions enable row level security;

drop policy if exists "Authenticated users read permissions" on public.permissions;
create policy "Authenticated users read permissions"
  on public.permissions for select to authenticated using (true);

drop policy if exists "Authenticated users read role permissions" on public.role_permissions;
create policy "Authenticated users read role permissions"
  on public.role_permissions for select to authenticated using (true);

drop policy if exists "Members read own overrides" on public.membership_permissions;
create policy "Members read own overrides"
  on public.membership_permissions for select to authenticated
  using (
    membership_id in (
      select id from public.user_memberships where user_id = auth.uid()
    )
  );

-- Canonical helper. Declared without a default argument so the compatible
-- three-argument overload below is unambiguous on every database version.
create or replace function public.member_has_permission(
  requested_resource text,
  requested_action text,
  owner_user_id uuid,
  requested_dossier_id uuid
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
          and membership.company_id in (
            select id from public.companies where user_id = owner_user_id
          )
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
      and (
        membership.role_name = 'manager'
        or coalesce(
          (
            select permission_override.is_granted
            from public.membership_permissions permission_override
            where permission_override.membership_id = membership.id
              and permission_override.resource = requested_resource
              and permission_override.action = requested_action
          ),
          exists (
            select 1
            from public.role_permissions preset
            where preset.role_name = membership.role_name
              and preset.resource = requested_resource
              and preset.action = requested_action
          )
        )
      )
  );
$$;

-- Some databases have only the four-argument helper without its original
-- default value. Restore the compatible three-argument signature used by
-- company-level policies.
create or replace function public.member_has_permission(
  requested_resource text,
  requested_action text,
  owner_user_id uuid
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.member_has_permission(
    requested_resource,
    requested_action,
    owner_user_id,
    null::uuid
  );
$$;

drop policy if exists "Members read company settings" on public.companies;
create policy "Members read company settings" on public.companies for select
  using (
    exists (
      select 1
      from public.user_memberships membership
      where membership.user_id = auth.uid()
        and membership.company_id = companies.id
        and membership.status = 'active'
    )
    or public.member_has_permission('settings', 'update', user_id)
    or public.member_has_permission('settings', 'manage_team', user_id)
  );

drop policy if exists "Members read owner preferences" on public.user_preferences;
create policy "Members read owner preferences" on public.user_preferences for select
  using (
    exists (
      select 1
      from public.user_memberships membership
      join public.companies company on company.id = membership.company_id
      where membership.user_id = auth.uid()
        and membership.status = 'active'
        and company.user_id = user_preferences.user_id
    )
  );

drop policy if exists "Members read invoices" on public.invoices;
create policy "Members read invoices" on public.invoices for select
  using (public.member_has_permission('invoice', 'read', user_id, dossier_id));
drop policy if exists "Members create invoices" on public.invoices;
create policy "Members create invoices" on public.invoices for insert
  with check (public.member_has_permission('invoice', 'create', user_id, dossier_id));
drop policy if exists "Members update invoices" on public.invoices;
create policy "Members update invoices" on public.invoices for update
  using (public.member_has_permission('invoice', 'create', user_id, dossier_id))
  with check (public.member_has_permission('invoice', 'create', user_id, dossier_id));
drop policy if exists "Members delete invoices" on public.invoices;
create policy "Members delete invoices" on public.invoices for delete
  using (public.member_has_permission('invoice', 'delete', user_id, dossier_id));

drop policy if exists "Members read clients" on public.clients;
create policy "Members read clients" on public.clients for select
  using (public.member_has_permission('invoice', 'read', user_id, dossier_id));
drop policy if exists "Members manage clients" on public.clients;
drop policy if exists "Members create clients" on public.clients;
drop policy if exists "Members update clients" on public.clients;
drop policy if exists "Members delete clients" on public.clients;
create policy "Members create clients" on public.clients for insert
  with check (public.member_has_permission('invoice', 'create', user_id, dossier_id));
create policy "Members update clients" on public.clients for update
  using (public.member_has_permission('invoice', 'create', user_id, dossier_id))
  with check (public.member_has_permission('invoice', 'create', user_id, dossier_id));
create policy "Members delete clients" on public.clients for delete
  using (public.member_has_permission('invoice', 'delete', user_id, dossier_id));

drop policy if exists "Members read transactions" on public.transactions;
create policy "Members read transactions" on public.transactions for select
  using (public.member_has_permission('accounting', 'read', user_id, dossier_id));
drop policy if exists "Members manage transactions" on public.transactions;
drop policy if exists "Members create transactions" on public.transactions;
drop policy if exists "Members update transactions" on public.transactions;
drop policy if exists "Members delete transactions" on public.transactions;
create policy "Members create transactions" on public.transactions for insert
  with check (public.member_has_permission('accounting', 'create', user_id, dossier_id));
create policy "Members update transactions" on public.transactions for update
  using (public.member_has_permission('accounting', 'create', user_id, dossier_id))
  with check (public.member_has_permission('accounting', 'create', user_id, dossier_id));
create policy "Members delete transactions" on public.transactions for delete
  using (public.member_has_permission('accounting', 'delete', user_id, dossier_id));

drop policy if exists "Members read accounting entries" on public.ecritures_comptables;
create policy "Members read accounting entries" on public.ecritures_comptables for select
  using (
    company_id in (
      select company.id
      from public.companies company
      where public.member_has_permission('accounting', 'read', company.user_id)
    )
    or dossier_id in (
      select dossier.id
      from public.dossiers dossier
      where public.member_has_permission('accounting', 'read', dossier.fiduciaire_user_id, dossier.id)
    )
  );
drop policy if exists "Members create accounting entries" on public.ecritures_comptables;
create policy "Members create accounting entries" on public.ecritures_comptables for insert
  with check (
    company_id in (
      select company.id
      from public.companies company
      where public.member_has_permission('accounting', 'create', company.user_id)
    )
    or dossier_id in (
      select dossier.id
      from public.dossiers dossier
      where public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
    )
  );

drop policy if exists "Members read receipts" on public.receipts;
create policy "Members read receipts" on public.receipts for select
  using (public.member_has_permission('document', 'read', user_id, dossier_id));
drop policy if exists "Members manage receipts" on public.receipts;
drop policy if exists "Members create receipts" on public.receipts;
drop policy if exists "Members update receipts" on public.receipts;
drop policy if exists "Members delete receipts" on public.receipts;
create policy "Members create receipts" on public.receipts for insert
  with check (public.member_has_permission('document', 'create', user_id, dossier_id));
create policy "Members update receipts" on public.receipts for update
  using (public.member_has_permission('document', 'create', user_id, dossier_id))
  with check (public.member_has_permission('document', 'create', user_id, dossier_id));
create policy "Members delete receipts" on public.receipts for delete
  using (public.member_has_permission('document', 'delete', user_id, dossier_id));

drop policy if exists "Members read supplier credit notes" on public.avoirs_fournisseurs;
create policy "Members read supplier credit notes" on public.avoirs_fournisseurs for select
  using (public.member_has_permission('accounting', 'read', user_id, dossier_id));
drop policy if exists "Members create supplier credit notes" on public.avoirs_fournisseurs;
create policy "Members create supplier credit notes" on public.avoirs_fournisseurs for insert
  with check (public.member_has_permission('accounting', 'create', user_id, dossier_id));

drop policy if exists "Members read company documents" on public.company_documents;
drop policy if exists "Members create company documents" on public.company_documents;
drop policy if exists "Members update company documents" on public.company_documents;
drop policy if exists "Members delete company documents" on public.company_documents;
create policy "Members read company documents" on public.company_documents for select
  using (public.member_has_permission('document', 'read', user_id, dossier_id));
create policy "Members create company documents" on public.company_documents for insert
  with check (public.member_has_permission('document', 'create', user_id, dossier_id));
create policy "Members update company documents" on public.company_documents for update
  using (public.member_has_permission('document', 'create', user_id, dossier_id))
  with check (public.member_has_permission('document', 'create', user_id, dossier_id));
create policy "Members delete company documents" on public.company_documents for delete
  using (public.member_has_permission('document', 'delete', user_id, dossier_id));

drop policy if exists "Members read dossier entries" on public.dossier_ecritures;
create policy "Members read dossier entries" on public.dossier_ecritures for select
  using (public.member_has_permission('accounting', 'read', fiduciaire_user_id, dossier_id));
drop policy if exists "Members manage dossier entries" on public.dossier_ecritures;
drop policy if exists "Members create dossier entries" on public.dossier_ecritures;
drop policy if exists "Members update dossier entries" on public.dossier_ecritures;
drop policy if exists "Members delete dossier entries" on public.dossier_ecritures;
create policy "Members create dossier entries" on public.dossier_ecritures for insert
  with check (public.member_has_permission('accounting', 'create', fiduciaire_user_id, dossier_id));
create policy "Members update dossier entries" on public.dossier_ecritures for update
  using (public.member_has_permission('accounting', 'create', fiduciaire_user_id, dossier_id))
  with check (public.member_has_permission('accounting', 'create', fiduciaire_user_id, dossier_id));
create policy "Members delete dossier entries" on public.dossier_ecritures for delete
  using (public.member_has_permission('accounting', 'delete', fiduciaire_user_id, dossier_id));

drop policy if exists "Members read dossier tva" on public.dossier_tva;
create policy "Members read dossier tva" on public.dossier_tva for select
  using (public.member_has_permission('tva_declaration', 'read', fiduciaire_user_id, dossier_id));
drop policy if exists "Members prepare dossier tva" on public.dossier_tva;
drop policy if exists "Members create dossier tva" on public.dossier_tva;
drop policy if exists "Members update dossier tva" on public.dossier_tva;
create policy "Members create dossier tva" on public.dossier_tva for insert
  with check (
    public.member_has_permission('tva_declaration', 'prepare', fiduciaire_user_id, dossier_id)
    or public.member_has_permission('tva_declaration', 'validate', fiduciaire_user_id, dossier_id)
  );
create policy "Members update dossier tva" on public.dossier_tva for update
  using (
    public.member_has_permission('tva_declaration', 'prepare', fiduciaire_user_id, dossier_id)
    or public.member_has_permission('tva_declaration', 'validate', fiduciaire_user_id, dossier_id)
  )
  with check (
    public.member_has_permission('tva_declaration', 'prepare', fiduciaire_user_id, dossier_id)
    or public.member_has_permission('tva_declaration', 'validate', fiduciaire_user_id, dossier_id)
  );

drop policy if exists "Members read company tva declarations" on public.tva_declarations;
create policy "Members read company tva declarations" on public.tva_declarations for select
  using (public.member_has_permission('tva_declaration', 'read', user_id));
drop policy if exists "Members create company tva declarations" on public.tva_declarations;
create policy "Members create company tva declarations" on public.tva_declarations for insert
  with check (
    public.member_has_permission('tva_declaration', 'prepare', user_id)
    or public.member_has_permission('tva_declaration', 'validate', user_id)
  );
drop policy if exists "Members update company tva declarations" on public.tva_declarations;
create policy "Members update company tva declarations" on public.tva_declarations for update
  using (
    public.member_has_permission('tva_declaration', 'prepare', user_id)
    or public.member_has_permission('tva_declaration', 'validate', user_id)
  )
  with check (
    public.member_has_permission('tva_declaration', 'prepare', user_id)
    or public.member_has_permission('tva_declaration', 'validate', user_id)
  );

drop policy if exists "Members read employees" on public.employees;
create policy "Members read employees" on public.employees for select
  using (
    public.member_has_permission('bulletin_paie', 'read', user_id, dossier_id)
    or public.member_has_permission('salary', 'read', user_id, dossier_id)
  );
drop policy if exists "Members manage employees" on public.employees;
create policy "Members manage employees" on public.employees for all
  using (public.member_has_permission('bulletin_paie', 'validate', user_id, dossier_id))
  with check (public.member_has_permission('bulletin_paie', 'validate', user_id, dossier_id));

drop policy if exists "Members read bulletins" on public.bulletins_paie;
create policy "Members read bulletins" on public.bulletins_paie for select
  using (
    public.member_has_permission(
      'bulletin_paie',
      'read',
      coalesce(
        (select user_id from public.companies where id = bulletins_paie.company_id),
        (select fiduciaire_user_id from public.dossiers where id = bulletins_paie.dossier_id)
      ),
      dossier_id
    )
  );
drop policy if exists "Members manage bulletins" on public.bulletins_paie;
create policy "Members manage bulletins" on public.bulletins_paie for all
  using (
    public.member_has_permission(
      'bulletin_paie',
      'validate',
      coalesce(
        (select user_id from public.companies where id = bulletins_paie.company_id),
        (select fiduciaire_user_id from public.dossiers where id = bulletins_paie.dossier_id)
      ),
      dossier_id
    )
  )
  with check (
    public.member_has_permission(
      'bulletin_paie',
      'validate',
      coalesce(
        (select user_id from public.companies where id = bulletins_paie.company_id),
        (select fiduciaire_user_id from public.dossiers where id = bulletins_paie.dossier_id)
      ),
      dossier_id
    )
  );

notify pgrst, 'reload schema';
