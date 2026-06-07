-- Fix Supabase Security Advisor warnings for public lookup/config tables.
-- These tables contain shared reference data needed by authenticated users.

do $$
begin
  if to_regclass('public.plan_limits') is not null then
    execute 'alter table public.plan_limits enable row level security';
    execute 'drop policy if exists "Authenticated users can read plan limits" on public.plan_limits';
    execute 'create policy "Authenticated users can read plan limits" on public.plan_limits for select to authenticated using (true)';
  end if;

  if to_regclass('public.jours_feries') is not null then
    execute 'alter table public.jours_feries enable row level security';
    execute 'drop policy if exists "Authenticated users can read holidays" on public.jours_feries';
    execute 'create policy "Authenticated users can read holidays" on public.jours_feries for select to authenticated using (true)';
  end if;

  if to_regclass('public.roles') is not null then
    execute 'alter table public.roles enable row level security';
    execute 'drop policy if exists "Authenticated users can read roles" on public.roles';
    execute 'create policy "Authenticated users can read roles" on public.roles for select to authenticated using (true)';
  end if;

  if to_regclass('public.permissions') is not null then
    execute 'alter table public.permissions enable row level security';
    execute 'drop policy if exists "Authenticated users can read permissions" on public.permissions';
    execute 'create policy "Authenticated users can read permissions" on public.permissions for select to authenticated using (true)';
  end if;

  if to_regclass('public.role_permissions') is not null then
    execute 'alter table public.role_permissions enable row level security';
    execute 'drop policy if exists "Authenticated users can read role permissions" on public.role_permissions';
    execute 'create policy "Authenticated users can read role permissions" on public.role_permissions for select to authenticated using (true)';
  end if;
end $$;
