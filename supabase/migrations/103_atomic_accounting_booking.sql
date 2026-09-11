-- Make automatic journal booking atomic and idempotent under concurrent requests.

create table if not exists public.accounting_booking_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  constraint accounting_booking_batches_scope_check
    check (num_nonnulls(company_id, dossier_id) = 1)
);

create unique index if not exists accounting_booking_batches_company_source
  on public.accounting_booking_batches(company_id, source_type, source_id)
  where company_id is not null;

create unique index if not exists accounting_booking_batches_dossier_source
  on public.accounting_booking_batches(dossier_id, source_type, source_id)
  where dossier_id is not null;

alter table public.accounting_booking_batches enable row level security;

drop policy if exists "Members read accounting booking batches" on public.accounting_booking_batches;
create policy "Members read accounting booking batches"
  on public.accounting_booking_batches for select
  using (
    company_id in (
      select company.id
      from public.companies company
      where public.member_has_permission('accounting', 'read', company.user_id)
    )
    or dossier_id in (
      select dossier.id
      from public.dossiers dossier
      where public.member_has_permission('accounting', 'read', dossier.fiduciaire_user_id, dossier.id)
    )
  );

drop policy if exists "Members create accounting booking batches" on public.accounting_booking_batches;
create policy "Members create accounting booking batches"
  on public.accounting_booking_batches for insert
  with check (
    company_id in (
      select company.id
      from public.companies company
      where public.member_has_permission('accounting', 'create', company.user_id)
    )
    or dossier_id in (
      select dossier.id
      from public.dossiers dossier
      where public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
    )
  );

create or replace function public.book_accounting_entries(
  p_company_id uuid,
  p_dossier_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_entries jsonb
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  entry jsonb;
  total_debit numeric;
  total_credit numeric;
begin
  if num_nonnulls(p_company_id, p_dossier_id) <> 1 then
    raise exception 'accounting_booking_scope_invalid';
  end if;
  if p_source_id is null or nullif(trim(p_source_type), '') is null then
    raise exception 'accounting_booking_source_invalid';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'accounting_booking_entries_invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_entries) as item(value)
    where value->>'source_id' is distinct from p_source_id::text
      or value->>'source_type' is distinct from p_source_type
      or nullif(trim(value->>'journal'), '') is null
      or nullif(trim(value->>'compte'), '') is null
      or nullif(trim(value->>'date_ecriture'), '') is null
      or coalesce((value->>'debit')::numeric, 0) < 0
      or coalesce((value->>'credit')::numeric, 0) < 0
      or (
        coalesce((value->>'debit')::numeric, 0) > 0
        and coalesce((value->>'credit')::numeric, 0) > 0
      )
  ) then
    raise exception 'accounting_booking_entry_invalid';
  end if;

  select
    coalesce(sum(coalesce((value->>'debit')::numeric, 0)), 0),
    coalesce(sum(coalesce((value->>'credit')::numeric, 0)), 0)
  into total_debit, total_credit
  from jsonb_array_elements(p_entries) as item(value);

  if abs(total_debit - total_credit) > 0.01 then
    raise exception 'accounting_booking_unbalanced';
  end if;

  begin
    insert into public.accounting_booking_batches (
      company_id, dossier_id, source_type, source_id
    ) values (
      p_company_id, p_dossier_id, p_source_type, p_source_id
    );
  exception when unique_violation then
    return false;
  end;

  for entry in
    select value from jsonb_array_elements(p_entries) as item(value)
  loop
    insert into public.ecritures_comptables (
      company_id,
      dossier_id,
      numero_piece,
      date_ecriture,
      journal,
      compte,
      compte_label,
      debit,
      credit,
      libelle,
      source_type,
      source_id
    ) values (
      p_company_id,
      p_dossier_id,
      nullif(entry->>'numero_piece', ''),
      (entry->>'date_ecriture')::date,
      entry->>'journal',
      entry->>'compte',
      nullif(entry->>'compte_label', ''),
      coalesce((entry->>'debit')::numeric, 0),
      coalesce((entry->>'credit')::numeric, 0),
      nullif(entry->>'libelle', ''),
      p_source_type,
      p_source_id
    );
  end loop;

  return true;
end;
$$;

revoke all on table public.accounting_booking_batches from anon;
grant select, insert on table public.accounting_booking_batches to authenticated;
revoke all on function public.book_accounting_entries(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function public.book_accounting_entries(uuid, uuid, text, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
