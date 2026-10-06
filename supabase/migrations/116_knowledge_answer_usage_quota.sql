create table if not exists public.knowledge_answer_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_month date not null,
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_month)
);

alter table public.knowledge_answer_usage enable row level security;
revoke all on public.knowledge_answer_usage from anon, authenticated;
grant all on public.knowledge_answer_usage to service_role;

create or replace function public.consume_knowledge_answer_quota(p_user_id uuid, p_limit integer default 100)
returns table(allowed boolean, used integer, usage_limit integer, reset_at date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', current_date)::date;
  v_next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_used integer;
begin
  if p_user_id is null then
    raise exception 'user_required';
  end if;

  insert into public.knowledge_answer_usage(user_id, usage_month, used_count)
  values (p_user_id, v_month, 1)
  on conflict (user_id, usage_month) do update
    set used_count = public.knowledge_answer_usage.used_count + 1,
        updated_at = now()
    where public.knowledge_answer_usage.used_count < v_limit
  returning used_count into v_used;

  if v_used is null then
    select usage.used_count into v_used
    from public.knowledge_answer_usage usage
    where usage.user_id = p_user_id and usage.usage_month = v_month;
    return query select false, coalesce(v_used, v_limit), v_limit, v_next_month;
    return;
  end if;

  return query select true, v_used, v_limit, v_next_month;
end;
$$;

revoke all on function public.consume_knowledge_answer_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_knowledge_answer_quota(uuid, integer) to service_role;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 116, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
