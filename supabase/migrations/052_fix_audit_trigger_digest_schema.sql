-- Repair audit trigger checksum so invoice/document uploads do not depend on
-- pgcrypto's digest() search path.

create or replace function public.log_financial_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_json jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_json jsonb := coalesce(new_json, old_json);
  scoped_company_id uuid := nullif(row_json->>'company_id', '')::uuid;
  scoped_dossier_id uuid := nullif(row_json->>'dossier_id', '')::uuid;
  actor_id uuid := auth.uid();
  actor_email text;
  action_name text;
  fields text[];
  created_ts timestamptz := now();
begin
  if scoped_company_id is null and scoped_dossier_id is null and row_json ? 'user_id' then
    select id into scoped_company_id
    from public.companies
    where user_id = nullif(row_json->>'user_id', '')::uuid
    limit 1;
  end if;

  select email into actor_email from auth.users where id = actor_id;

  if tg_op = 'INSERT' then
    action_name := 'CREATE';
  elsif tg_op = 'UPDATE' then
    action_name := 'UPDATE';
    select array_agg(key order by key) into fields
    from (
      select key from jsonb_each(coalesce(old_json, '{}'::jsonb))
      union
      select key from jsonb_each(coalesce(new_json, '{}'::jsonb))
    ) keys
    where old_json->key is distinct from new_json->key;
  else
    action_name := 'DELETE';
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    company_id,
    dossier_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    old_values,
    new_values,
    changed_fields,
    success,
    checksum,
    created_at
  ) values (
    actor_id,
    actor_email,
    scoped_company_id,
    scoped_dossier_id,
    action_name,
    tg_table_name,
    nullif(row_json->>'id', '')::uuid,
    coalesce(
      row_json->>'invoice_number',
      row_json->>'period_label',
      row_json->>'description',
      row_json->>'name',
      row_json->>'nom'
    ),
    old_json,
    new_json,
    fields,
    true,
    md5(coalesce(row_json::text, '') || tg_op || created_ts::text),
    created_ts
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
