-- Public signups must be reviewed and activated by an administrator.
-- Existing approved accounts remain unchanged; this affects future signups.
insert into public.signup_activation_settings (
  singleton,
  manual_approval_enabled,
  updated_at
)
values (true, true, now())
on conflict (singleton) do update set
  manual_approval_enabled = true,
  updated_at = now();

notify pgrst, 'reload schema';
