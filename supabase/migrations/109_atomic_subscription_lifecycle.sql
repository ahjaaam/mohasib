-- Run the daily subscription lifecycle in one bounded database transaction.

create or replace function public.run_subscription_lifecycle(
  p_today date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company_record record;
  scheduled_subscription_id uuid;
  scheduled_subscription_ends_at date;
  scheduled_applied integer := 0;
  trials_expired integer := 0;
  subscriptions_moved_to_grace integer := 0;
  subscriptions_expired integer := 0;
  subscription_rows_expired integer := 0;
  limit_overrides_deleted integer := 0;
begin
  if p_today is null then
    raise exception 'subscription_lifecycle_date_required';
  end if;

  -- Prevent a manual retry from racing the scheduled invocation.
  perform pg_advisory_xact_lock(hashtext('subscription-lifecycle'));

  for company_record in
    select company.id, company.scheduled_plan
    from public.companies company
    where company.scheduled_plan is not null
      and company.scheduled_plan_date <= p_today
    for update
  loop
    scheduled_subscription_id := null;
    scheduled_subscription_ends_at := null;

    select subscription.id, subscription.ends_at
    into scheduled_subscription_id, scheduled_subscription_ends_at
    from public.subscriptions subscription
    where subscription.company_id = company_record.id
      and subscription.status = 'scheduled'
    order by subscription.starts_at asc
    limit 1
    for update;

    update public.subscriptions subscription
    set status = 'cancelled'
    where subscription.company_id = company_record.id
      and subscription.status = 'active';

    if scheduled_subscription_id is not null then
      update public.subscriptions
      set status = 'active'
      where id = scheduled_subscription_id;
    end if;

    update public.companies
    set
      plan = company_record.scheduled_plan,
      subscription_status = 'active',
      subscription_ends_at = scheduled_subscription_ends_at,
      scheduled_plan = null,
      scheduled_plan_date = null
    where id = company_record.id;

    scheduled_applied := scheduled_applied + 1;
  end loop;

  update public.companies company
  set subscription_status = 'expired'
  where company.subscription_status = 'trial'
    and company.trial_ends_at < p_today;
  get diagnostics trials_expired = row_count;

  update public.companies company
  set subscription_status = 'grace'
  where company.subscription_status = 'active'
    and company.subscription_ends_at < p_today
    and company.subscription_ends_at >= p_today - 7;
  get diagnostics subscriptions_moved_to_grace = row_count;

  update public.companies company
  set subscription_status = 'expired'
  where company.subscription_status in ('active', 'grace')
    and company.subscription_ends_at < p_today - 7;
  get diagnostics subscriptions_expired = row_count;

  update public.subscriptions subscription
  set status = 'expired'
  where subscription.status = 'active'
    and subscription.ends_at < p_today;
  get diagnostics subscription_rows_expired = row_count;

  delete from public.company_limit_overrides override_row
  where override_row.expires_at < p_today;
  get diagnostics limit_overrides_deleted = row_count;

  return jsonb_build_object(
    'scheduledApplied', scheduled_applied,
    'trialsExpired', trials_expired,
    'subscriptionsMovedToGrace', subscriptions_moved_to_grace,
    'subscriptionsExpired', subscriptions_expired,
    'subscriptionRowsExpired', subscription_rows_expired,
    'limitOverridesDeleted', limit_overrides_deleted
  );
end;
$$;

revoke all on function public.run_subscription_lifecycle(date) from public;
grant execute on function public.run_subscription_lifecycle(date) to service_role;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 109, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
