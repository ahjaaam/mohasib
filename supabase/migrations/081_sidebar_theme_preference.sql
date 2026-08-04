alter table public.user_preferences
  add column if not exists sidebar_theme text not null default 'dark'
  check (sidebar_theme in ('dark', 'cream'));

comment on column public.user_preferences.sidebar_theme is
  'Account navigation sidebar theme: dark or cream.';
