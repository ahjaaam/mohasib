-- Finalize customer credit notes and record supplier payments atomically.

alter table public.invoice_payments
  add column if not exists request_id uuid;

create unique index if not exists invoice_payments_request_id_unique
  on public.invoice_payments(request_id)
  where request_id is not null;

create or replace function public.finalize_credit_note_accounting_entries(
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
  credit_note public.invoices%rowtype;
  booked boolean;
begin
  if p_source_type <> 'avoir_client' then
    raise exception 'credit_note_finalize_source_invalid';
  end if;
  if num_nonnulls(p_company_id, p_dossier_id) <> 1 then
    raise exception 'credit_note_finalize_scope_invalid';
  end if;

  select *
  into credit_note
  from public.invoices
  where id = p_source_id
  for update;

  if not found then
    raise exception 'credit_note_not_found_or_out_of_scope';
  end if;
  if credit_note.invoice_type <> 'avoir_client' then
    raise exception 'credit_note_type_required';
  end if;
  if credit_note.status::text <> 'draft' then
    raise exception 'credit_note_not_draft';
  end if;
  if credit_note.dossier_id is distinct from p_dossier_id then
    raise exception 'credit_note_finalize_scope_invalid';
  end if;
  if p_dossier_id is null and not exists (
    select 1
    from public.companies company
    where company.id = p_company_id
      and company.user_id = credit_note.user_id
  ) then
    raise exception 'credit_note_finalize_scope_invalid';
  end if;

  if exists (
    select 1
    from public.accounting_periods period
    where period.mois = extract(month from credit_note.issue_date)::integer
      and period.annee = extract(year from credit_note.issue_date)::integer
      and period.is_locked = true
      and coalesce(period.is_unlocked, false) = false
      and (
        (p_company_id is not null and period.company_id = p_company_id)
        or (p_dossier_id is not null and period.dossier_id = p_dossier_id)
      )
  ) then
    raise exception 'period_locked';
  end if;

  booked := public.book_accounting_entries(
    p_company_id,
    p_dossier_id,
    p_source_type,
    p_source_id,
    p_entries
  );
  if not booked then
    raise exception 'credit_note_already_booked';
  end if;

  update public.invoices
  set status = 'sent'
  where id = credit_note.id;

  return true;
end;
$$;

revoke all on function public.finalize_credit_note_accounting_entries(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function public.finalize_credit_note_accounting_entries(uuid, uuid, text, uuid, jsonb) to authenticated;

create or replace function public.enforce_credit_note_accounting_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.invoice_type, 'facture') <> 'avoir_client' then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status::text not in ('draft', 'cancelled') then
    raise exception 'credit_note_must_start_as_draft';
  end if;

  if tg_op = 'UPDATE' then
    if old.status::text = 'draft'
       and new.status::text not in ('draft', 'cancelled')
       and not exists (
         select 1
         from public.accounting_booking_batches batch
         where batch.source_type = 'avoir_client'
           and batch.source_id = new.id
           and batch.company_id is not distinct from (
             case when new.dossier_id is null then (
               select company.id
               from public.companies company
               where company.user_id = new.user_id
               order by company.created_at
               limit 1
             ) else null end
           )
           and batch.dossier_id is not distinct from new.dossier_id
       ) then
      raise exception 'credit_note_accounting_entries_required';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_credit_note_accounting_lifecycle_trigger on public.invoices;
create trigger enforce_credit_note_accounting_lifecycle_trigger
before insert or update on public.invoices
for each row execute function public.enforce_credit_note_accounting_lifecycle();

create or replace function public.record_supplier_payment(
  p_receipt_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text default null,
  p_reference text default null,
  p_notes text default null,
  p_request_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  receipt_row public.receipts%rowtype;
  existing_payment public.invoice_payments%rowtype;
  payment_row public.invoice_payments%rowtype;
  company_id_value uuid;
  existing_paid numeric;
  new_paid numeric;
  document_total numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'payment_amount_invalid';
  end if;
  if p_payment_date is null then
    raise exception 'payment_date_required';
  end if;

  select *
  into receipt_row
  from public.receipts
  where id = p_receipt_id
  for update;

  if not found then
    raise exception 'supplier_document_not_found_or_out_of_scope';
  end if;

  if p_request_id is not null then
    select *
    into existing_payment
    from public.invoice_payments
    where request_id = p_request_id;

    if found then
      if existing_payment.inbox_item_id is distinct from p_receipt_id
         or existing_payment.montant is distinct from p_amount
         or existing_payment.date_paiement is distinct from p_payment_date
         or existing_payment.mode_paiement is distinct from nullif(p_payment_method, '')
         or existing_payment.reference is distinct from nullif(p_reference, '')
         or existing_payment.notes is distinct from nullif(p_notes, '') then
        raise exception 'payment_request_conflict';
      end if;
      return jsonb_build_object(
        'payment', to_jsonb(existing_payment),
        'receipt', jsonb_build_object(
          'id', receipt_row.id,
          'montant_paye', coalesce((receipt_row.ocr_data->>'montant_paye')::numeric, 0),
          'payment_status', receipt_row.ocr_data->>'payment_status'
        ),
        'replayed', true
      );
    end if;
  end if;

  if receipt_row.dossier_id is null then
    select company.id
    into company_id_value
    from public.companies company
    where company.user_id = receipt_row.user_id
    order by company.created_at
    limit 1;

    if company_id_value is null then
      raise exception 'supplier_payment_company_missing';
    end if;
  end if;

  if exists (
    select 1
    from public.accounting_periods period
    where period.mois = extract(month from p_payment_date)::integer
      and period.annee = extract(year from p_payment_date)::integer
      and period.is_locked = true
      and coalesce(period.is_unlocked, false) = false
      and (
        (receipt_row.dossier_id is null and period.company_id = company_id_value)
        or (receipt_row.dossier_id is not null and period.dossier_id = receipt_row.dossier_id)
      )
  ) then
    raise exception 'period_locked';
  end if;

  document_total := abs(coalesce(nullif(receipt_row.ocr_data->>'amount', '')::numeric, 0));
  if document_total <= 0 then
    raise exception 'supplier_document_amount_missing';
  end if;

  select coalesce(sum(payment.montant), 0)
  into existing_paid
  from public.invoice_payments payment
  where payment.inbox_item_id = p_receipt_id
    and payment.allocation_status = 'confirmed'
    and payment.payment_type = 'decaissement';

  if existing_paid + p_amount > document_total + 0.01 then
    raise exception 'payment_exceeds_supplier_balance';
  end if;

  insert into public.invoice_payments (
    invoice_id, inbox_item_id, company_id, dossier_id, montant,
    date_paiement, mode_paiement, reference, notes, payment_type,
    allocation_status, match_confidence, match_method, match_evidence,
    confirmed_by, confirmed_at, request_id
  ) values (
    null, receipt_row.id, company_id_value, receipt_row.dossier_id, p_amount,
    p_payment_date, nullif(p_payment_method, ''), nullif(p_reference, ''),
    nullif(p_notes, ''), 'decaissement', 'confirmed', 1,
    'manual_payment_entry', jsonb_build_object('source', 'supplier_payment_form'),
    auth.uid(), now(), p_request_id
  )
  returning * into payment_row;

  new_paid := existing_paid + p_amount;
  update public.receipts
  set ocr_data = coalesce(ocr_data, '{}'::jsonb) || jsonb_build_object(
    'montant_paye', new_paid,
    'payment_status', case
      when new_paid >= document_total - 0.01 then 'paid'
      else 'partial'
    end
  )
  where id = receipt_row.id;

  return jsonb_build_object(
    'payment', to_jsonb(payment_row),
    'receipt', jsonb_build_object(
      'id', receipt_row.id,
      'montant_paye', new_paid,
      'payment_status', case
        when new_paid >= document_total - 0.01 then 'paid'
        else 'partial'
      end
    ),
    'replayed', false
  );
end;
$$;

revoke all on function public.record_supplier_payment(uuid, numeric, date, text, text, text, uuid) from public;
grant execute on function public.record_supplier_payment(uuid, numeric, date, text, text, text, uuid) to authenticated;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 108, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
