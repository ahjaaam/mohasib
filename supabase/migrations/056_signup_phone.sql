-- Store signup phone numbers in the profile and admin approval queue.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.users.phone);

  -- Invited collaborators are approved through their invitation workflow.
  if lower(coalesce(new.raw_user_meta_data->>'invited_member', 'false')) <> 'true'
     and coalesce(new.raw_user_meta_data->>'invitation_token', '') = '' then
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
