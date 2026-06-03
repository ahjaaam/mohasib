alter table public.fiduciaire_waitlist
  add column if not exists nom text,
  add column if not exists telephone text,
  add column if not exists track text default 'comptable';
