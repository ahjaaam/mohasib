-- Qualify personalised video-demo requests and retain the requested use case
-- in the unified lead queue used by the admin back office.
alter table public.demo_requests
  add column if not exists profil text,
  add column if not exists besoin text;

alter table public.fiduciaire_waitlist
  add column if not exists besoin text;

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
    besoin,
    request_kind,
    status,
    demo_request_id
  )
  values (
    new.nom,
    lower(new.email),
    new.telephone,
    new.entreprise,
    case
      when new.profil in ('comptable', 'fiduciaire') then 'comptable'
      else 'entrepreneur'
    end,
    'demande-video-demo',
    new.besoin,
    'demo',
    'pending',
    new.id
  )
  on conflict do nothing;
  return new;
end;
$$;

update public.fiduciaire_waitlist queued
set besoin = demo.besoin
from public.demo_requests demo
where queued.demo_request_id = demo.id
  and queued.besoin is null;
