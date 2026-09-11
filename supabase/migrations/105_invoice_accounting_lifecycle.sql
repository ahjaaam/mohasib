-- Keep editable invoice drafts outside the ledger and finalize them atomically.

-- Earlier clients booked drafts in a fire-and-forget request. Drafts are not
-- accounting documents, so remove those generated rows and their idempotency
-- markers before the corrected lifecycle is used.
delete from public.ecritures_comptables entry
using public.invoices invoice
where entry.source_type = 'invoice'
  and entry.source_id = invoice.id
  and invoice.status::text = 'draft';

delete from public.accounting_booking_batches batch
using public.invoices invoice
where batch.source_type = 'invoice'
  and batch.source_id = invoice.id
  and invoice.status::text = 'draft';

create or replace function public.finalize_invoice_accounting_entries(
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
  invoice_owner_id uuid;
  invoice_dossier_id uuid;
  invoice_status_value text;
  booked boolean;
begin
  if p_source_type <> 'invoice' then
    raise exception 'invoice_finalize_source_invalid';
  end if;

  select invoice.user_id, invoice.dossier_id, invoice.status::text
  into invoice_owner_id, invoice_dossier_id, invoice_status_value
  from public.invoices invoice
  where invoice.id = p_source_id
  for update;

  if not found then
    raise exception 'invoice_not_found_or_out_of_scope';
  end if;
  if invoice_status_value <> 'draft' then
    raise exception 'invoice_not_draft';
  end if;
  if invoice_dossier_id is distinct from p_dossier_id then
    raise exception 'invoice_finalize_scope_invalid';
  end if;
  if p_dossier_id is null and not exists (
    select 1 from public.companies company
    where company.id = p_company_id and company.user_id = invoice_owner_id
  ) then
    raise exception 'invoice_finalize_scope_invalid';
  end if;

  booked := public.book_accounting_entries(
    p_company_id,
    p_dossier_id,
    p_source_type,
    p_source_id,
    p_entries
  );
  if not booked then
    raise exception 'invoice_already_booked';
  end if;

  update public.invoices
  set status = 'sent'
  where id = p_source_id;

  return true;
end;
$$;

revoke all on function public.finalize_invoice_accounting_entries(uuid, uuid, text, uuid, jsonb) from public;
grant execute on function public.finalize_invoice_accounting_entries(uuid, uuid, text, uuid, jsonb) to authenticated;

-- Finalized invoices are corrected with credit notes/reversals, not deletion.
drop policy if exists "Members delete invoices" on public.invoices;
create policy "Members delete invoices" on public.invoices for delete
  using (
    public.member_has_permission('invoice', 'delete', user_id, dossier_id)
    and (invoice_type = 'devis' or status::text = 'draft')
  );

-- Payment/status fields may still change, but the accounting substance of a
-- finalized invoice is immutable.
create or replace function public.protect_finalized_invoice_accounting_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(old.invoice_type, 'facture') in ('facture', 'avoir_client')
     and old.status::text <> 'draft'
     and (
       new.client_id is distinct from old.client_id
       or new.invoice_number is distinct from old.invoice_number
       or new.issue_date is distinct from old.issue_date
       or new.subtotal is distinct from old.subtotal
       or new.tax_rate is distinct from old.tax_rate
       or new.tax_amount is distinct from old.tax_amount
       or new.total is distinct from old.total
       or new.currency is distinct from old.currency
       or new.items is distinct from old.items
       or new.discount_type is distinct from old.discount_type
       or new.discount_mode is distinct from old.discount_mode
       or new.discount_value is distinct from old.discount_value
       or new.discount_amount is distinct from old.discount_amount
     ) then
    raise exception 'finalized_invoice_accounting_fields_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_finalized_invoice_accounting_fields_trigger on public.invoices;
create trigger protect_finalized_invoice_accounting_fields_trigger
before update on public.invoices
for each row execute function public.protect_finalized_invoice_accounting_fields();

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 105, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
