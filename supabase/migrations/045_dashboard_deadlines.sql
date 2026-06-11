alter table public.user_preferences
  add column if not exists dashboard_deadlines jsonb;

comment on column public.user_preferences.dashboard_deadlines is
  'User-managed deadlines displayed on the main dashboard.';
