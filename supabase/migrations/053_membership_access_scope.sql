alter table public.user_memberships
  add column if not exists access_scope text default 'both';

update public.user_memberships
set access_scope = coalesce(access_scope, 'both');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_memberships_access_scope_valid'
      and conrelid = 'public.user_memberships'::regclass
  ) then
    alter table public.user_memberships
      add constraint user_memberships_access_scope_valid
      check (access_scope in ('business_only', 'comptable_pro_only', 'both'));
  end if;
end $$;
