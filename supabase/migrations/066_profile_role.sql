-- Store the user's display-only job title from the profile settings form.
-- Authorization roles remain managed separately by the team/RBAC tables.

alter table public.users
  add column if not exists role text;

comment on column public.users.role is
  'Display-only job title entered in profile settings; not used for authorization.';
