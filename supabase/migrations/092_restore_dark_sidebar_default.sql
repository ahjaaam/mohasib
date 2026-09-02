-- New accounts start with the dark navigation theme. Existing accounts remain
-- unchanged except for signup accounts repaired from the old activation flow.
alter table public.user_preferences
  alter column sidebar_theme set default 'dark';

-- Repair signup accounts that inherited the old automatic seven-day trial at
-- approval time. Preserve trials that an administrator explicitly configured.
with activated_signups as (
  select company.id, company.user_id
  from public.companies as company
  where company.plan = 'trial'
    and company.subscription_status = 'trial'
    and exists (
      select 1
      from public.fiduciaire_waitlist as signup
      where signup.auth_user_id = company.user_id
        and signup.request_kind = 'signup'
        and signup.status = 'approved'
    )
    and not exists (
      select 1
      from public.audit_logs as audit
      where audit.company_id = company.id
        and (
          audit.action = 'ADMIN_TRIAL_EXTEND'
          or (
            audit.action = 'ADMIN_ACCOUNT_ACCESS_UPDATE'
            and audit.new_values ->> 'subscription_status' = 'trial'
          )
        )
    )
), repaired_accounts as (
  update public.companies as company
  set
    plan = 'custom',
    subscription_status = 'active',
    subscription_ends_at = null,
    trial_ends_at = null
  from activated_signups
  where company.id = activated_signups.id
  returning company.user_id
)
insert into public.user_preferences (user_id, sidebar_theme)
select user_id, 'dark'
from repaired_accounts
on conflict (user_id) do update
set sidebar_theme = excluded.sidebar_theme;

comment on column public.user_preferences.sidebar_theme is
  'Account navigation sidebar theme: dark by default, with cream available as an option.';

notify pgrst, 'reload schema';
