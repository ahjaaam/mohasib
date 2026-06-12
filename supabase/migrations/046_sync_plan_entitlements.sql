alter table public.plan_limits
  add column if not exists employee_limit integer default 0,
  add column if not exists has_tva_edi boolean default false,
  add column if not exists has_inbox_global boolean default false;

alter table public.company_limit_overrides
  add column if not exists employee_limit integer,
  add column if not exists has_tva_edi boolean,
  add column if not exists has_inbox_global boolean;

update public.plan_limits set employee_limit = case plan
  when 'trial' then 0
  when 'starter' then 0
  when 'business' then 10
  when 'business_pro' then -1
  when 'comptable_s' then 5
  when 'comptable_pro' then 10
  when 'comptable_inf' then -1
  else 0
end;

update public.plan_limits set
  ocr_limit = 50, storage_gb = 5, dossiers_limit = 0, users_limit = 1,
  has_bank_import = false, has_saisie = false, has_paie = false,
  has_export_fiduciaire = false, has_avoirs = false, has_bilan = false,
  has_mass_declarations = false
where plan = 'starter';

update public.plan_limits set
  ocr_limit = 50, storage_gb = 5, dossiers_limit = 0, users_limit = 1,
  has_bank_import = false, has_saisie = false, has_paie = false,
  has_export_fiduciaire = false, has_avoirs = false, has_bilan = false,
  has_mass_declarations = false
where plan = 'trial';

update public.plan_limits set
  ocr_limit = 250, storage_gb = 25, dossiers_limit = 0, users_limit = 1,
  has_bank_import = true, has_saisie = true, has_paie = true,
  has_export_fiduciaire = true, has_avoirs = true, has_bilan = false,
  has_mass_declarations = false
where plan = 'business';

update public.plan_limits set
  ocr_limit = -1, storage_gb = -1, dossiers_limit = 0, users_limit = 3,
  has_bank_import = true, has_saisie = true, has_paie = true,
  has_export_fiduciaire = true, has_avoirs = true, has_bilan = true,
  has_mass_declarations = false
where plan = 'business_pro';

update public.plan_limits set
  has_tva_edi = plan in ('business', 'business_pro', 'comptable_s', 'comptable_pro', 'comptable_inf'),
  has_inbox_global = plan in ('comptable_pro', 'comptable_inf');

notify pgrst, 'reload schema';

create or replace function public.effective_numeric_plan_limit(owner_id uuid, limit_key text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    nullif(to_jsonb(o) ->> limit_key, '')::integer,
    nullif(to_jsonb(p) ->> limit_key, '')::integer,
    0
  )
  from public.companies c
  left join public.plan_limits p on p.plan = coalesce(c.plan, 'starter')
  left join public.company_limit_overrides o
    on o.company_id = c.id
    and (o.expires_at is null or o.expires_at >= current_date)
  where c.user_id = owner_id
  limit 1;
$$;

create or replace function public.enforce_dossier_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_count integer;
  current_count integer;
begin
  allowed_count := public.effective_numeric_plan_limit(new.fiduciaire_user_id, 'dossiers_limit');
  if allowed_count = 0 then
    raise exception 'Votre plan ne permet pas de créer des dossiers clients.';
  end if;
  if allowed_count > 0 then
    select count(*) into current_count from public.dossiers where fiduciaire_user_id = new.fiduciaire_user_id;
    if current_count >= allowed_count then
      raise exception 'Limite de dossiers atteinte pour votre plan (%).', allowed_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_dossier_plan_limit_trigger on public.dossiers;
create trigger enforce_dossier_plan_limit_trigger
before insert on public.dossiers
for each row execute function public.enforce_dossier_plan_limit();

create or replace function public.enforce_employee_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_count integer;
  current_count integer;
begin
  allowed_count := public.effective_numeric_plan_limit(new.user_id, 'employee_limit');
  if allowed_count = 0 then
    raise exception 'La Paie n''est pas incluse dans votre plan.';
  end if;
  if allowed_count > 0 then
    select count(*) into current_count
    from public.employees
    where user_id = new.user_id
      and dossier_id is not distinct from new.dossier_id;
    if current_count >= allowed_count then
      raise exception 'Limite d''employés atteinte pour votre plan (%).', allowed_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_employee_plan_limit_trigger on public.employees;
create trigger enforce_employee_plan_limit_trigger
before insert on public.employees
for each row execute function public.enforce_employee_plan_limit();
