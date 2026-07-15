-- Require a phone number at the database boundary for every new Auth user,
-- including public, invitation, and admin-created accounts.
create or replace function public.require_signup_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(new.raw_user_meta_data->>'phone', '')), '') is null then
    raise exception 'Le numéro de téléphone est obligatoire.';
  end if;

  new.raw_user_meta_data := jsonb_set(
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    '{phone}',
    to_jsonb(btrim(new.raw_user_meta_data->>'phone')),
    true
  );
  return new;
end;
$$;

drop trigger if exists require_signup_phone_trigger on auth.users;
create trigger require_signup_phone_trigger
before insert on auth.users
for each row execute function public.require_signup_phone();
