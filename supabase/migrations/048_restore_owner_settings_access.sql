-- Restore explicit owner-only access to account settings.
-- Some production databases never received the original bootstrap policies.

alter table public.companies enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "Members read company settings" on public.companies;
drop policy if exists "Members read owner preferences" on public.user_preferences;

drop policy if exists "Users manage own company" on public.companies;
create policy "Users manage own company"
  on public.companies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
