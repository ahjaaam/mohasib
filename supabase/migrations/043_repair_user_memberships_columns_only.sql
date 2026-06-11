alter table public.user_memberships add column if not exists user_id uuid;
alter table public.user_memberships add column if not exists user_email text;
alter table public.user_memberships add column if not exists company_id uuid;
alter table public.user_memberships add column if not exists dossier_id uuid;
alter table public.user_memberships add column if not exists role_name text;
alter table public.user_memberships add column if not exists dossier_scope uuid[];
alter table public.user_memberships add column if not exists status text default 'active';
alter table public.user_memberships add column if not exists invitation_token text;
alter table public.user_memberships add column if not exists employee_id uuid;
alter table public.user_memberships add column if not exists invited_by uuid;
alter table public.user_memberships add column if not exists invited_at timestamptz;
alter table public.user_memberships add column if not exists accepted_at timestamptz;
alter table public.user_memberships add column if not exists invitation_expires_at timestamptz;
alter table public.user_memberships add column if not exists first_name text;
alter table public.user_memberships add column if not exists last_name text;
alter table public.user_memberships add column if not exists created_at timestamptz default now();
alter table public.user_memberships alter column user_id drop not null;

notify pgrst, 'reload schema';

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_memberships'
order by ordinal_position;
