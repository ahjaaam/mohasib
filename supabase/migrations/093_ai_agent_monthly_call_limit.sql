-- Account-wide monthly allowance for Mohasib Agent. Owners and collaborators
-- consume the same pool, reset on the first day of each Casablanca month.
create table if not exists public.ai_agent_monthly_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  period_month date not null,
  calls integer not null default 0 check (calls >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, period_month)
);

alter table public.ai_agent_monthly_usage enable row level security;
revoke all on table public.ai_agent_monthly_usage from public, anon, authenticated;

create or replace function public.consume_ai_agent_monthly_call(
  p_company_id uuid,
  p_limit integer default 10
)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  monthly_limit integer,
  reset_date date
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period date := date_trunc('month', clock_timestamp() at time zone 'Africa/Casablanca')::date;
  v_used integer;
  v_allowed boolean;
begin
  if p_company_id is null or p_limit < 1 then
    raise exception 'invalid AI agent usage arguments';
  end if;

  insert into public.ai_agent_monthly_usage as usage (
    company_id,
    period_month,
    calls
  ) values (
    p_company_id,
    v_period,
    1
  )
  on conflict (company_id, period_month) do update
  set
    calls = usage.calls + 1,
    updated_at = clock_timestamp()
  where usage.calls < p_limit
  returning calls into v_used;

  v_allowed := found;

  if v_used is null then
    select calls into v_used
    from public.ai_agent_monthly_usage
    where company_id = p_company_id
      and period_month = v_period;
  end if;

  return query select
    v_allowed,
    v_used,
    greatest(0, p_limit - v_used),
    p_limit,
    (v_period + interval '1 month')::date;
end;
$$;

revoke all on function public.consume_ai_agent_monthly_call(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_agent_monthly_call(uuid, integer) to service_role;

notify pgrst, 'reload schema';
