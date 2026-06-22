-- Automatically activate public signups while retaining a database switch
-- that can restore manual approval when needed.
create table if not exists public.signup_activation_settings (
  singleton boolean primary key default true check (singleton),
  manual_approval_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.signup_activation_settings (singleton, manual_approval_enabled)
values (true, false)
on conflict (singleton) do update set
  manual_approval_enabled = false,
  updated_at = now();

alter table public.signup_activation_settings enable row level security;
revoke all on table public.signup_activation_settings from anon, authenticated;

create or replace function public.activate_signup_account(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user auth.users%rowtype;
  account_type text;
  account_name text;
  account_phone text;
  account_company_id uuid;
begin
  select *
  into auth_user
  from auth.users
  where id = p_user_id;

  if auth_user.id is null then
    raise exception 'Auth user % not found', p_user_id;
  end if;

  account_type := case
    when auth_user.raw_user_meta_data->>'user_type' = 'fiduciaire' then 'fiduciaire'
    else 'entrepreneur'
  end;
  account_name := coalesce(
    nullif(auth_user.raw_user_meta_data->>'company', ''),
    nullif(auth_user.raw_user_meta_data->>'full_name', ''),
    'Mon entreprise'
  );
  account_phone := nullif(auth_user.raw_user_meta_data->>'phone', '');

  insert into public.users (id, email, full_name, company, phone)
  values (
    auth_user.id,
    auth_user.email,
    coalesce(auth_user.raw_user_meta_data->>'full_name', ''),
    account_name,
    account_phone
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    company = coalesce(nullif(excluded.company, ''), public.users.company),
    phone = coalesce(excluded.phone, public.users.phone);

  insert into public.companies (
    user_id,
    raison_sociale,
    email,
    phone,
    user_type,
    plan,
    trial_ends_at,
    subscription_status,
    is_suspended
  )
  values (
    auth_user.id,
    account_name,
    auth_user.email,
    account_phone,
    account_type,
    'trial',
    now() + interval '7 days',
    'trial',
    false
  )
  on conflict (user_id) do update set
    raison_sociale = coalesce(nullif(excluded.raison_sociale, ''), public.companies.raison_sociale),
    email = coalesce(excluded.email, public.companies.email),
    phone = coalesce(excluded.phone, public.companies.phone),
    user_type = excluded.user_type
  returning id into account_company_id;

  insert into public.user_memberships (
    user_id,
    user_email,
    company_id,
    role_name,
    status,
    accepted_at
  )
  values (
    auth_user.id,
    auth_user.email,
    account_company_id,
    case when account_type = 'fiduciaire' then 'cabinet_owner' else 'owner' end,
    'active',
    now()
  )
  on conflict do nothing;

  if account_type = 'fiduciaire' then
    insert into public.cabinets (user_id, nom_cabinet, email, telephone)
    values (auth_user.id, account_name, auth_user.email, account_phone)
    on conflict (user_id) do update set
      nom_cabinet = coalesce(nullif(excluded.nom_cabinet, ''), public.cabinets.nom_cabinet),
      email = coalesce(excluded.email, public.cabinets.email),
      telephone = coalesce(excluded.telephone, public.cabinets.telephone);
  end if;

  insert into public.fiduciaire_waitlist (
    user_id,
    auth_user_id,
    nom,
    email,
    telephone,
    entreprise,
    track,
    source,
    request_kind,
    status,
    approved_at,
    approved_by
  )
  values (
    auth_user.id,
    auth_user.id,
    nullif(auth_user.raw_user_meta_data->>'full_name', ''),
    lower(auth_user.email),
    account_phone,
    account_name,
    case when account_type = 'fiduciaire' then 'comptable' else 'entrepreneur' end,
    'inscription',
    'signup',
    'approved',
    now(),
    'activation-automatique'
  )
  on conflict do nothing;

  update public.fiduciaire_waitlist
  set
    user_id = auth_user.id,
    auth_user_id = auth_user.id,
    telephone = coalesce(account_phone, telephone),
    entreprise = coalesce(nullif(account_name, ''), entreprise),
    status = 'approved',
    approved_at = coalesce(approved_at, now()),
    approved_by = coalesce(approved_by, 'activation-automatique')
  where request_kind = 'signup'
    and lower(email) = lower(auth_user.email);

  return account_company_id;
end;
$$;

revoke all on function public.activate_signup_account(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manual_approval boolean := false;
begin
  insert into public.users (id, email, full_name, company, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'company', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    company = coalesce(excluded.company, public.users.company),
    phone = coalesce(excluded.phone, public.users.phone);

  -- Invited collaborators continue through their dedicated invitation workflow.
  if lower(coalesce(new.raw_user_meta_data->>'invited_member', 'false')) = 'true'
     or coalesce(new.raw_user_meta_data->>'invitation_token', '') <> '' then
    return new;
  end if;

  select coalesce(manual_approval_enabled, false)
  into manual_approval
  from public.signup_activation_settings
  where singleton = true;

  if manual_approval then
    insert into public.fiduciaire_waitlist (
      user_id,
      auth_user_id,
      nom,
      email,
      telephone,
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
      nullif(new.raw_user_meta_data->>'phone', ''),
      nullif(new.raw_user_meta_data->>'company', ''),
      case when new.raw_user_meta_data->>'user_type' = 'fiduciaire' then 'comptable' else 'entrepreneur' end,
      'inscription',
      'signup',
      'pending'
    )
    on conflict do nothing;
  else
    perform public.activate_signup_account(new.id);
  end if;

  return new;
end;
$$;

-- Activate accounts that were waiting when automatic activation was enabled.
do $$
declare
  pending_signup record;
begin
  for pending_signup in
    select distinct auth_user_id
    from public.fiduciaire_waitlist
    where request_kind = 'signup'
      and status = 'pending'
      and auth_user_id is not null
  loop
    perform public.activate_signup_account(pending_signup.auth_user_id);
  end loop;
end;
$$;
