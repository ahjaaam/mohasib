alter table public.user_preferences
  alter column sidebar_theme set default 'cream';

-- Establish the new product default for existing accounts. Users can still
-- switch back to the dark theme from Settings > Appearance.
update public.user_preferences
set sidebar_theme = 'cream'
where sidebar_theme = 'dark';

comment on column public.user_preferences.sidebar_theme is
  'Account navigation sidebar theme: cream by default, with dark available as an option.';
