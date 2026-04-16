-- Demo requests from homepage
create table if not exists public.demo_requests (
  id          uuid primary key default gen_random_uuid(),
  nom         text,
  email       text not null,
  telephone   text,
  entreprise  text,
  created_at  timestamptz not null default now()
);

-- Fiduciaire / accountant waitlist
create table if not exists public.fiduciaire_waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,
  created_at  timestamptz not null default now()
);

-- Public insert, no auth required
alter table public.demo_requests enable row level security;
alter table public.fiduciaire_waitlist enable row level security;

create policy "Anyone can insert demo_requests"
  on public.demo_requests for insert
  with check (true);

create policy "Anyone can insert fiduciaire_waitlist"
  on public.fiduciaire_waitlist for insert
  with check (true);
