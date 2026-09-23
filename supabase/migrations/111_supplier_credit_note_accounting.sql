-- Book supplier credit notes atomically and retain the original-purchase context.

alter table public.avoirs_fournisseurs
  add column if not exists linked_receipt_id uuid references public.receipts(id) on delete set null,
  add column if not exists source_receipt_id uuid references public.receipts(id) on delete set null,
  add column if not exists adjustment_type text,
  add column if not exists original_purchase_account text;

update public.avoirs_fournisseurs
set adjustment_type = 'commercial_reduction'
where adjustment_type is null;

alter table public.avoirs_fournisseurs
  alter column adjustment_type set default 'commercial_reduction',
  alter column adjustment_type set not null;

alter table public.avoirs_fournisseurs
  drop constraint if exists avoirs_fournisseurs_adjustment_type_check;
alter table public.avoirs_fournisseurs
  add constraint avoirs_fournisseurs_adjustment_type_check check (
    adjustment_type in (
      'commercial_reduction',
      'purchase_return',
      'invoice_correction',
      'partial_cancellation',
      'settlement_discount',
      'other'
    )
  );

alter table public.avoirs_fournisseurs
  drop constraint if exists avoirs_fournisseurs_original_purchase_account_check;
alter table public.avoirs_fournisseurs
  add constraint avoirs_fournisseurs_original_purchase_account_check check (
    original_purchase_account is null
    or original_purchase_account ~ '^[26][0-9]{3,11}$'
  );

create index if not exists avoirs_fournisseurs_linked_receipt_idx
  on public.avoirs_fournisseurs(linked_receipt_id);

create unique index if not exists avoirs_fournisseurs_source_receipt_unique
  on public.avoirs_fournisseurs(source_receipt_id)
  where source_receipt_id is not null;

drop policy if exists "Members update supplier credit notes" on public.avoirs_fournisseurs;
create policy "Members update supplier credit notes"
  on public.avoirs_fournisseurs for update
  using (public.member_has_permission('accounting', 'create', user_id, dossier_id))
  with check (public.member_has_permission('accounting', 'create', user_id, dossier_id));

create or replace function public.finalize_supplier_credit_note_accounting_entries(
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
  credit_note public.avoirs_fournisseurs%rowtype;
  booked boolean;
begin
  if p_source_type <> 'supplier_credit_note' then
    raise exception 'supplier_credit_note_finalize_source_invalid';
  end if;
  if num_nonnulls(p_company_id, p_dossier_id) <> 1 then
    raise exception 'supplier_credit_note_finalize_scope_invalid';
  end if;

  select *
  into credit_note
  from public.avoirs_fournisseurs
  where id = p_source_id
  for update;

  if not found then
    raise exception 'supplier_credit_note_not_found_or_out_of_scope';
  end if;
  if credit_note.dossier_id is distinct from p_dossier_id then
    raise exception 'supplier_credit_note_finalize_scope_invalid';
  end if;
  if p_dossier_id is null and not exists (
    select 1
    from public.companies company
    where company.id = p_company_id
      and company.user_id = credit_note.user_id
  ) then
    raise exception 'supplier_credit_note_finalize_scope_invalid';
  end if;
  if credit_note.statut not in ('brouillon', 'recu', 'comptabilise') then
    raise exception 'supplier_credit_note_status_invalid';
  end if;
  if credit_note.original_purchase_account is null then
    raise exception 'supplier_credit_note_original_account_required';
  end if;

  if exists (
    select 1
    from public.accounting_periods period
    where period.mois = extract(month from credit_note.date)::integer
      and period.annee = extract(year from credit_note.date)::integer
      and period.is_locked = true
      and coalesce(period.is_unlocked, false) = false
      and (
        (p_company_id is not null and period.company_id = p_company_id)
        or (p_dossier_id is not null and period.dossier_id = p_dossier_id)
      )
  ) then
    raise exception 'period_locked';
  end if;

  if exists (
    select 1
    from public.accounting_booking_batches batch
    where batch.source_type = p_source_type
      and batch.source_id = p_source_id
      and batch.company_id is not distinct from p_company_id
      and batch.dossier_id is not distinct from p_dossier_id
  ) then
    update public.avoirs_fournisseurs
    set statut = 'comptabilise', updated_at = now()
    where id = credit_note.id;
    return true;
  end if;

  booked := public.book_accounting_entries(
    p_company_id,
    p_dossier_id,
    p_source_type,
    p_source_id,
    p_entries
  );
  if not booked then
    raise exception 'supplier_credit_note_already_booked';
  end if;

  update public.avoirs_fournisseurs
  set statut = 'comptabilise', updated_at = now()
  where id = credit_note.id;

  return true;
end;
$$;

revoke all on function public.finalize_supplier_credit_note_accounting_entries(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function public.finalize_supplier_credit_note_accounting_entries(uuid, uuid, text, uuid, jsonb) to authenticated;

create or replace function public.enforce_supplier_credit_note_accounting_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.statut <> 'brouillon' then
    raise exception 'supplier_credit_note_must_start_as_draft';
  end if;

  if tg_op = 'UPDATE'
     and old.statut <> 'comptabilise'
     and new.statut = 'comptabilise'
     and not exists (
       select 1
       from public.accounting_booking_batches batch
       where batch.source_type = 'supplier_credit_note'
         and batch.source_id = new.id
         and batch.dossier_id is not distinct from new.dossier_id
         and batch.company_id is not distinct from (
           case when new.dossier_id is null then (
             select company.id
             from public.companies company
             where company.user_id = new.user_id
             order by company.created_at
             limit 1
           ) else null end
         )
     ) then
    raise exception 'supplier_credit_note_accounting_entries_required';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_supplier_credit_note_accounting_lifecycle_trigger
  on public.avoirs_fournisseurs;
create trigger enforce_supplier_credit_note_accounting_lifecycle_trigger
before insert or update on public.avoirs_fournisseurs
for each row execute function public.enforce_supplier_credit_note_accounting_lifecycle();

notify pgrst, 'reload schema';
