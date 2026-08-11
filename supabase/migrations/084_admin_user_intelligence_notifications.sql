-- Admin user intelligence and notification campaigns.
-- The notifications table existed in production before it was captured in the
-- ordered migration history, so every statement is safe for existing projects.

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  link text,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  category text not null default 'service' check (category in ('service', 'billing', 'compliance', 'support', 'product', 'marketing')),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'both')),
  audience jsonb not null default '{"type":"all"}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null default 'admin_message',
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  unique_key text,
  campaign_id uuid references public.notification_campaigns(id) on delete set null,
  read_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists type text not null default 'admin_message',
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists link text,
  add column if not exists is_read boolean not null default false,
  add column if not exists is_dismissed boolean not null default false,
  add column if not exists priority text not null default 'normal',
  add column if not exists unique_key text,
  add column if not exists campaign_id uuid references public.notification_campaigns(id) on delete set null,
  add column if not exists read_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.notification_campaigns(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed', 'skipped')),
  sent_at timestamptz,
  read_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id, channel)
);

alter table public.companies
  add column if not exists admin_tags text[] not null default '{}',
  add column if not exists admin_owner_email text,
  add column if not exists lifecycle_stage text not null default 'active',
  add column if not exists archived_at timestamptz;

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, is_read, created_at desc)
  where is_dismissed = false;
create unique index if not exists idx_notifications_user_unique_key
  on public.notifications(user_id, unique_key);
create index if not exists idx_notification_campaigns_status_schedule
  on public.notification_campaigns(status, scheduled_at);
create index if not exists idx_notification_deliveries_campaign_status
  on public.notification_deliveries(campaign_id, status);
create index if not exists idx_companies_admin_tags on public.companies using gin(admin_tags);

alter table public.notification_campaigns enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

revoke all on table public.notification_campaigns from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;

comment on table public.notification_campaigns is 'Admin-authored notification broadcasts and scheduled messages.';
comment on table public.notification_deliveries is 'Per-recipient delivery, read, click, and error tracking.';
