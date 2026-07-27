-- Quick support tickets — opened directly from the app top bar (next to
-- notifications), instead of routing the user through Centre d'aide.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete set null,
  dossier_id uuid references public.dossiers(id) on delete set null,
  user_email text not null,
  user_name text,
  subject text not null,
  message text not null,
  page_url text,
  status text not null default 'nouveau',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_status on public.support_tickets(status, created_at desc);
create index if not exists idx_support_tickets_user on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "Users create support tickets" on public.support_tickets;
create policy "Users create support tickets" on public.support_tickets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users read own support tickets" on public.support_tickets;
create policy "Users read own support tickets" on public.support_tickets for select
  using (auth.uid() = user_id);
