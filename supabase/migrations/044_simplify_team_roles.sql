-- Mohasib exposes two team roles: Propriétaire and Responsable.
-- Normalize historical secondary roles to the Responsable preset.

update public.user_memberships
set role_name = 'manager',
    dossier_scope = null
where role_name in ('employee', 'collaborateur', 'read_auditor');

notify pgrst, 'reload schema';
