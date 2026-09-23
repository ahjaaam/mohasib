-- Confirm an incoming purchase document and its journal in one transaction.
create or replace function public.finalize_receipt_purchase_accounting_entries(
  p_company_id uuid,
  p_dossier_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_entries jsonb,
  p_ocr_data jsonb
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  receipt_row public.receipts%rowtype;
  settings jsonb;
  purchase_account text;
  supplier_account text;
  vat_account text;
  escompte_account text;
  document_type text;
  supplier_name text;
  invoice_reference text;
  gross_ht numeric;
  commercial_discount numeric;
  settlement_discount numeric;
  net_ht numeric;
  vat_amount numeric;
  total_ttc numeric;
  rate numeric;
  expected_count integer;
  booked boolean;
begin
  if p_source_type <> 'purchase' or num_nonnulls(p_company_id, p_dossier_id) <> 1 then
    raise exception 'purchase_confirmation_scope_invalid';
  end if;
  if jsonb_typeof(p_ocr_data) <> 'object' then
    raise exception 'purchase_confirmation_data_required';
  end if;

  select * into receipt_row
  from public.receipts
  where id = p_source_id
  for update;
  if not found or receipt_row.dossier_id is distinct from p_dossier_id then
    raise exception 'purchase_receipt_not_found_or_out_of_scope';
  end if;

  if p_company_id is not null then
    select company.accounting_settings into settings
    from public.companies company
    where company.id = p_company_id and company.user_id = receipt_row.user_id;
  else
    select dossier.accounting_settings into settings
    from public.dossiers dossier
    where dossier.id = p_dossier_id and dossier.fiduciaire_user_id = receipt_row.user_id;
  end if;
  if not found then
    raise exception 'purchase_confirmation_scope_invalid';
  end if;

  if receipt_row.status = 'matched' and exists (
    select 1 from public.accounting_booking_batches batch
    where batch.source_type = 'purchase' and batch.source_id = p_source_id
      and batch.company_id is not distinct from p_company_id
      and batch.dossier_id is not distinct from p_dossier_id
  ) then
    return true;
  end if;
  if receipt_row.status <> 'pending' or receipt_row.control_status <> 'review' then
    raise exception 'purchase_receipt_not_pending_review';
  end if;
  if receipt_row.approval_status not in ('not_requested', 'approved') then
    raise exception 'purchase_approval_required';
  end if;
  document_type := p_ocr_data->>'document_type';
  if receipt_row.document_area not in ('purchase', 'legacy', 'supporting_document')
     or document_type is null or document_type not in ('invoice', 'receipt')
     or receipt_row.ocr_data->>'document_type' in ('purchase_order', 'delivery_note', 'avoir', 'bank_statement', 'other')
     or (receipt_row.document_area <> 'supporting_document'
       and coalesce((receipt_row.ocr_data->>'is_supplier_invoice')::boolean, true) = false)
     or (receipt_row.document_area <> 'supporting_document'
       and coalesce((p_ocr_data->>'is_supplier_invoice')::boolean, true) = false) then
    raise exception 'purchase_document_type_invalid';
  end if;

  supplier_name := nullif(trim(coalesce(p_ocr_data->>'vendor_name', p_ocr_data->>'vendor', '')), '');
  invoice_reference := nullif(trim(coalesce(p_ocr_data->>'receipt_number', p_ocr_data->>'invoice_number', '')), '');
  purchase_account := p_ocr_data->>'compte';
  supplier_account := case when settings->>'supplierAccount' ~ '^4[0-9]{3,11}$'
    then settings->>'supplierAccount' else '4411' end;
  vat_account := case when settings->>'recoverableTvaAccount' ~ '^[34][0-9]{3,11}$'
    then settings->>'recoverableTvaAccount' else '3455' end;
  escompte_account := case when settings->>'purchaseSettlementDiscountAccount' ~ '^7[0-9]{3,11}$'
    then settings->>'purchaseSettlementDiscountAccount' else '7386' end;
  if purchase_account is null or purchase_account !~ '^[26][0-9]{3,11}$'
     or supplier_account !~ '^4[0-9]{3,11}$'
     or vat_account !~ '^[34][0-9]{3,11}$'
     or escompte_account !~ '^7[0-9]{3,11}$' then
    raise exception 'purchase_account_invalid';
  end if;
  if supplier_name is null or p_ocr_data->>'date' is null then
    raise exception 'purchase_supplier_or_date_required';
  end if;

  gross_ht := (p_ocr_data->>'amount_ht')::numeric;
  commercial_discount := coalesce((p_ocr_data->>'commercial_discount_amount')::numeric, 0);
  settlement_discount := coalesce((p_ocr_data->>'settlement_discount_amount')::numeric, 0);
  vat_amount := coalesce((p_ocr_data->>'tva_amount')::numeric, 0);
  total_ttc := (p_ocr_data->>'amount_ttc')::numeric;
  rate := coalesce((p_ocr_data->>'tva_rate')::numeric, 0);
  net_ht := gross_ht - commercial_discount;
  if gross_ht is null or gross_ht <= 0 or commercial_discount < 0 or settlement_discount < 0
     or net_ht <= 0 or settlement_discount >= net_ht or vat_amount < 0 or total_ttc is null
     or total_ttc <= 0 or rate not in (0, 7, 10, 14, 20)
     or abs((net_ht - settlement_discount + vat_amount) - total_ttc) > 0.01 then
    raise exception 'purchase_amounts_invalid';
  end if;
  if rate > 0 and abs(round((net_ht - settlement_discount) * rate / 100, 2) - vat_amount) > 0.02 then
    raise exception 'purchase_vat_invalid';
  end if;
  if rate = 0 and vat_amount <> 0 then
    raise exception 'purchase_vat_invalid';
  end if;

  if invoice_reference is not null and exists (
    select 1 from public.receipts prior
    where prior.id <> receipt_row.id
      and prior.created_at < receipt_row.created_at
      and prior.user_id = receipt_row.user_id
      and prior.dossier_id is not distinct from receipt_row.dossier_id
      and prior.ocr_data->>'document_type' in ('invoice', 'receipt')
      and lower(regexp_replace(coalesce(prior.ocr_data->>'vendor_name', prior.ocr_data->>'vendor', ''), '[^[:alnum:]]', '', 'g'))
        = lower(regexp_replace(supplier_name, '[^[:alnum:]]', '', 'g'))
      and lower(regexp_replace(coalesce(prior.ocr_data->>'receipt_number', prior.ocr_data->>'invoice_number', ''), '[^[:alnum:]]', '', 'g'))
        = lower(regexp_replace(invoice_reference, '[^[:alnum:]]', '', 'g'))
  ) then
    raise exception 'purchase_duplicate_reference';
  end if;

  if exists (
    select 1 from public.accounting_periods period
    where period.mois = extract(month from (p_ocr_data->>'date')::date)::integer
      and period.annee = extract(year from (p_ocr_data->>'date')::date)::integer
      and period.is_locked = true
      and coalesce(period.is_unlocked, false) = false
      and ((p_company_id is not null and period.company_id = p_company_id)
        or (p_dossier_id is not null and period.dossier_id = p_dossier_id))
  ) then
    raise exception 'period_locked';
  end if;

  expected_count := 2 + case when vat_amount > 0 then 1 else 0 end
    + case when settlement_discount > 0 then 1 else 0 end;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) <> expected_count
     or exists (
       select 1 from jsonb_array_elements(p_entries) item
       where item->>'journal' <> 'AC'
         or item->>'date_ecriture' <> p_ocr_data->>'date'
     )
     or not exists (
       select 1 from jsonb_array_elements(p_entries) item
       where item->>'compte' = purchase_account and (item->>'debit')::numeric = net_ht
         and coalesce((item->>'credit')::numeric, 0) = 0
     )
     or not exists (
       select 1 from jsonb_array_elements(p_entries) item
       where item->>'compte' = supplier_account and (item->>'credit')::numeric = total_ttc
         and coalesce((item->>'debit')::numeric, 0) = 0
     )
     or (vat_amount > 0 and not exists (
       select 1 from jsonb_array_elements(p_entries) item
       where item->>'compte' = vat_account and (item->>'debit')::numeric = vat_amount
         and coalesce((item->>'credit')::numeric, 0) = 0
     ))
     or (settlement_discount > 0 and not exists (
       select 1 from jsonb_array_elements(p_entries) item
       where item->>'compte' = escompte_account and (item->>'credit')::numeric = settlement_discount
         and coalesce((item->>'debit')::numeric, 0) = 0
     )) then
    raise exception 'purchase_entries_invalid';
  end if;

  booked := public.book_accounting_entries(
    p_company_id, p_dossier_id, p_source_type, p_source_id, p_entries
  );
  if not booked then
    raise exception 'purchase_already_booked';
  end if;

  update public.receipts
  set ocr_data = p_ocr_data, status = 'matched'
  where id = p_source_id;
  if p_dossier_id is not null then
    update public.dossiers set derniere_ecriture = now() where id = p_dossier_id;
  end if;
  return true;
end;
$$;

revoke all on function public.finalize_receipt_purchase_accounting_entries(uuid, uuid, text, uuid, jsonb, jsonb) from public;
grant execute on function public.finalize_receipt_purchase_accounting_entries(uuid, uuid, text, uuid, jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
