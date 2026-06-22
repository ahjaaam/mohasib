-- Unified admin approval queue for signups and homepage demo requests.
alter table public.fiduciaire_waitlist
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists nom text,
  add column if not exists telephone text,
  add column if not exists track text default 'entrepreneur',
  add column if not exists source text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists entreprise text,
  add column if not exists request_kind text not null default 'waitlist',
  add column if not exists status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists demo_request_id uuid references public.demo_requests(id) on delete set null;

create index if not exists idx_waitlist_status_created
  on public.fiduciaire_waitlist(status, created_at desc);
create index if not exists idx_waitlist_auth_user
  on public.fiduciaire_waitlist(auth_user_id)
  where auth_user_id is not null;
create unique index if not exists idx_waitlist_signup_email
  on public.fiduciaire_waitlist(lower(email))
  where request_kind = 'signup';
create unique index if not exists idx_waitlist_demo_request
  on public.fiduciaire_waitlist(demo_request_id)
  where demo_request_id is not null;

-- Public visitors may join the basic waitlist, but cannot manufacture signup
-- approvals or read the queue's personal data.
drop policy if exists "Anyone can join waitlist with email" on public.fiduciaire_waitlist;
drop policy if exists "Anyone can insert fiduciaire_waitlist" on public.fiduciaire_waitlist;
drop policy if exists "Users insert own waitlist entry" on public.fiduciaire_waitlist;
drop policy if exists "Anyone can read waitlist count" on public.fiduciaire_waitlist;
create policy "Public can submit pending waitlist lead"
  on public.fiduciaire_waitlist
  for insert
  to anon, authenticated
  with check (
    email is not null
    and length(email) between 3 and 320
    and request_kind = 'waitlist'
    and status = 'pending'
    and auth_user_id is null
    and approved_at is null
    and approved_by is null
    and demo_request_id is null
  );

-- Signup remains atomic: if the queue entry cannot be created, Auth signup fails too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;

  -- Invited collaborators are approved through their invitation workflow.
  if lower(coalesce(new.raw_user_meta_data->>'invited_member', 'false')) <> 'true'
     and coalesce(new.raw_user_meta_data->>'invitation_token', '') = '' then
    insert into public.fiduciaire_waitlist (
      user_id,
      auth_user_id,
      nom,
      email,
      entreprise,
      track,
      source,
      request_kind,
      status
    )
    values (
      new.id,
      new.id,
      nullif(new.raw_user_meta_data->>'full_name', ''),
      lower(new.email),
      nullif(new.raw_user_meta_data->>'company', ''),
      case
        when new.raw_user_meta_data->>'user_type' = 'fiduciaire' then 'comptable'
        else 'entrepreneur'
      end,
      'inscription',
      'signup',
      'pending'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.queue_demo_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fiduciaire_waitlist (
    nom,
    email,
    telephone,
    entreprise,
    track,
    source,
    request_kind,
    status,
    demo_request_id
  )
  values (
    new.nom,
    lower(new.email),
    new.telephone,
    new.entreprise,
    'entrepreneur',
    'demande-demo',
    'demo',
    'pending',
    new.id
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_demo_request_created on public.demo_requests;
create trigger on_demo_request_created
  after insert on public.demo_requests
  for each row execute function public.queue_demo_request();

-- Surface existing standalone signups that never received a company/account.
insert into public.fiduciaire_waitlist (
  user_id, auth_user_id, nom, email, entreprise, track, source,
  request_kind, status, created_at
)
select
  auth_user.id,
  auth_user.id,
  nullif(auth_user.raw_user_meta_data->>'full_name', ''),
  lower(auth_user.email),
  nullif(auth_user.raw_user_meta_data->>'company', ''),
  case
    when auth_user.raw_user_meta_data->>'user_type' = 'fiduciaire' then 'comptable'
    else 'entrepreneur'
  end,
  'inscription-historique',
  'signup',
  'pending',
  auth_user.created_at
from auth.users auth_user
where auth_user.email is not null
  and lower(coalesce(auth_user.raw_user_meta_data->>'invited_member', 'false')) <> 'true'
  and not exists (select 1 from public.companies company where company.user_id = auth_user.id)
  and not exists (select 1 from public.user_memberships membership where membership.user_id = auth_user.id)
  and not exists (
    select 1 from public.fiduciaire_waitlist queued
    where queued.request_kind = 'signup'
      and lower(queued.email) = lower(auth_user.email)
  );

-- Bring historical demo requests into the same admin queue.
insert into public.fiduciaire_waitlist (
  nom, email, telephone, entreprise, track, source, request_kind, status,
  demo_request_id, created_at
)
select
  demo.nom,
  lower(demo.email),
  demo.telephone,
  demo.entreprise,
  'entrepreneur',
  'demande-demo',
  'demo',
  'pending',
  demo.id,
  demo.created_at
from public.demo_requests demo
where not exists (
  select 1
  from public.fiduciaire_waitlist queued
  where queued.demo_request_id = demo.id
);
