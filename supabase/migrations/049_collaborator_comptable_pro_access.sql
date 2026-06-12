-- Let company collaborators use their owner's Comptable Pro workspace.
-- Cabinet/account settings remain owner-only because managers never receive
-- the "settings" resource.

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
      and membership.company_id in (
        select company.id
        from public.companies company
        where company.user_id = owner_user_id
      )
      and (
        requested_dossier_id is null
        or membership.dossier_id = requested_dossier_id
        or membership.dossier_scope is null
        or requested_dossier_id = any(membership.dossier_scope)
      )
      and (
        (membership.role_name = 'manager' and requested_resource <> 'settings')
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

drop policy if exists "Members read cabinet" on public.cabinets;
create policy "Members read cabinet" on public.cabinets for select
  using (public.member_has_permission('dossier', 'read', user_id));

drop policy if exists "Members read dossiers" on public.dossiers;
create policy "Members read dossiers" on public.dossiers for select
  using (public.member_has_permission('dossier', 'read', fiduciaire_user_id, id));

drop policy if exists "Members update dossiers" on public.dossiers;
create policy "Members update dossiers" on public.dossiers for update
  using (public.member_has_permission('accounting', 'create', fiduciaire_user_id, id))
  with check (public.member_has_permission('accounting', 'create', fiduciaire_user_id, id));

drop policy if exists "Members read global inbox" on public.inbox_global;
create policy "Members read global inbox" on public.inbox_global for select
  using (public.member_has_permission('document', 'read', fiduciaire_user_id));

drop policy if exists "Members update global inbox" on public.inbox_global;
create policy "Members update global inbox" on public.inbox_global for update
  using (public.member_has_permission('document', 'create', fiduciaire_user_id))
  with check (public.member_has_permission('document', 'create', fiduciaire_user_id));

drop policy if exists "Members read routing rules" on public.email_routing_rules;
create policy "Members read routing rules" on public.email_routing_rules for select
  using (public.member_has_permission('document', 'read', fiduciaire_user_id));

drop policy if exists "Members create routing rules" on public.email_routing_rules;
create policy "Members create routing rules" on public.email_routing_rules for insert
  with check (public.member_has_permission('document', 'create', fiduciaire_user_id, dossier_id));

drop policy if exists "Members manage fiduciaire events" on public.fiduciaire_events;
create policy "Members manage fiduciaire events" on public.fiduciaire_events for all
  using (public.member_has_permission('dossier', 'read', fiduciaire_user_id, dossier_id))
  with check (public.member_has_permission('dossier', 'read', fiduciaire_user_id, dossier_id));

drop policy if exists "Members read dossier closures" on public.dossier_clotures;
create policy "Members read dossier closures" on public.dossier_clotures for select
  using (public.member_has_permission('accounting', 'read', fiduciaire_user_id, dossier_id));

drop policy if exists "Members create dossier closures" on public.dossier_clotures;
create policy "Members create dossier closures" on public.dossier_clotures for insert
  with check (public.member_has_permission('accounting', 'lock', fiduciaire_user_id, dossier_id));

notify pgrst, 'reload schema';
