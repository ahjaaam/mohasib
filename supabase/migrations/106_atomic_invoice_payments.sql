-- Make confirmed payment evidence the source of truth for invoice settlement.

-- Preserve valid legacy payment history by promoting JSON-only payments into
-- the authoritative allocation table. Occurrence numbers preserve legitimate
-- duplicate payments while avoiding rows already mirrored there.
with legacy_payments as (
  select
    invoice.id as invoice_id,
    invoice.dossier_id,
    case when invoice.dossier_id is null then (
      select company.id
      from public.companies company
      where company.user_id = invoice.user_id
      order by company.created_at
      limit 1
    ) end as company_id,
    (payment.value->>'date')::date as payment_date,
    (payment.value->>'montant')::numeric as amount,
    nullif(payment.value->>'mode', '') as payment_method,
    nullif(payment.value->>'note', '') as notes,
    row_number() over (
      partition by invoice.id, payment.value->>'date', payment.value->>'montant', lower(coalesce(payment.value->>'mode', ''))
      order by payment.ordinality
    ) as occurrence
  from public.invoices invoice
  cross join lateral jsonb_array_elements(coalesce(invoice.paiements, '[]'::jsonb))
    with ordinality as payment(value, ordinality)
  where coalesce(invoice.invoice_type, 'facture') = 'facture'
    and payment.value->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and payment.value->>'montant' ~ '^[0-9]+(\.[0-9]+)?$'
    and (payment.value->>'montant')::numeric > 0
)
insert into public.invoice_payments (
  invoice_id, company_id, dossier_id, montant, date_paiement,
  mode_paiement, notes, payment_type, allocation_status,
  match_confidence, match_method, match_evidence, confirmed_at
)
select
  legacy.invoice_id, legacy.company_id, legacy.dossier_id, legacy.amount,
  legacy.payment_date, legacy.payment_method, legacy.notes, 'encaissement',
  'confirmed', 1, 'legacy_invoice_history',
  jsonb_build_object('source', 'invoices.paiements'), now()
from legacy_payments legacy
where (
  select count(*)
  from public.invoice_payments existing
  where existing.invoice_id = legacy.invoice_id
    and existing.allocation_status = 'confirmed'
    and existing.payment_type = 'encaissement'
    and existing.date_paiement = legacy.payment_date
    and existing.montant = legacy.amount
    and lower(coalesce(existing.mode_paiement, '')) = lower(coalesce(legacy.payment_method, ''))
) < legacy.occurrence;

-- Repair summary fields, including old status-only "paid" transitions that
-- never had dated payment evidence. Such invoices return to outstanding.
with evidence as (
  select
    invoice.id,
    coalesce(sum(payment.montant) filter (
      where payment.allocation_status = 'confirmed'
        and payment.payment_type = 'encaissement'
    ), 0) as paid_amount
  from public.invoices invoice
  left join public.invoice_payments payment on payment.invoice_id = invoice.id
  where coalesce(invoice.invoice_type, 'facture') = 'facture'
  group by invoice.id
)
update public.invoices invoice
set montant_recu = least(evidence.paid_amount, greatest(coalesce(invoice.total, 0), 0)),
    montant_paye = least(evidence.paid_amount, greatest(coalesce(invoice.total, 0), 0)),
    reste_a_payer = greatest(coalesce(invoice.total, 0) - evidence.paid_amount, 0),
    status = case
      when evidence.paid_amount >= coalesce(invoice.total, 0) - 0.01 and coalesce(invoice.total, 0) > 0
        then 'paid'::public.invoice_status
      when evidence.paid_amount > 0
        then 'partiellement_payee'::public.invoice_status
      when invoice.status::text in ('paid', 'partiellement_payee')
        then 'sent'::public.invoice_status
      else invoice.status
    end
from evidence
where invoice.id = evidence.id
  and (
    coalesce(invoice.montant_recu, 0) is distinct from least(evidence.paid_amount, greatest(coalesce(invoice.total, 0), 0))
    or coalesce(invoice.montant_paye, 0) is distinct from least(evidence.paid_amount, greatest(coalesce(invoice.total, 0), 0))
    or coalesce(invoice.reste_a_payer, 0) is distinct from greatest(coalesce(invoice.total, 0) - evidence.paid_amount, 0)
    or (invoice.status::text = 'paid' and evidence.paid_amount < coalesce(invoice.total, 0) - 0.01)
    or (invoice.status::text = 'partiellement_payee' and evidence.paid_amount <= 0)
  );

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text default null,
  p_reference text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
  company_id_value uuid;
  existing_paid numeric;
  new_paid numeric;
  invoice_total numeric;
  payment_row public.invoice_payments%rowtype;
  new_status public.invoice_status;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'payment_amount_invalid';
  end if;
  if p_payment_date is null then
    raise exception 'payment_date_required';
  end if;

  select * into invoice_row
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'invoice_not_found_or_out_of_scope';
  end if;
  if coalesce(invoice_row.invoice_type, 'facture') <> 'facture' then
    raise exception 'payment_requires_client_invoice';
  end if;
  if invoice_row.status::text = 'draft' then
    raise exception 'draft_invoice_must_be_finalized';
  end if;
  if invoice_row.status::text = 'cancelled' then
    raise exception 'cancelled_invoice_cannot_be_paid';
  end if;

  select coalesce(sum(montant), 0)
  into existing_paid
  from public.invoice_payments
  where invoice_id = p_invoice_id
    and allocation_status = 'confirmed'
    and payment_type = 'encaissement';

  invoice_total := greatest(coalesce(invoice_row.total, 0), 0);
  if existing_paid + p_amount > invoice_total + 0.01 then
    raise exception 'payment_exceeds_invoice_balance';
  end if;

  if invoice_row.dossier_id is null then
    select id into company_id_value
    from public.companies
    where user_id = invoice_row.user_id
    order by created_at
    limit 1;
  end if;

  insert into public.invoice_payments (
    invoice_id, company_id, dossier_id, montant, date_paiement,
    mode_paiement, reference, notes, payment_type, allocation_status,
    match_confidence, match_method, match_evidence,
    confirmed_by, confirmed_at
  ) values (
    invoice_row.id, company_id_value, invoice_row.dossier_id, p_amount,
    p_payment_date, nullif(p_payment_method, ''), nullif(p_reference, ''),
    nullif(p_notes, ''), 'encaissement', 'confirmed', 1,
    'manual_payment_entry', jsonb_build_object('source', 'invoice_payment_form'),
    auth.uid(), now()
  ) returning * into payment_row;

  new_paid := existing_paid + p_amount;
  new_status := case
    when new_paid >= invoice_total - 0.01 then 'paid'::public.invoice_status
    else 'partiellement_payee'::public.invoice_status
  end;

  update public.invoices
  set montant_recu = least(new_paid, invoice_total),
      montant_paye = least(new_paid, invoice_total),
      reste_a_payer = greatest(invoice_total - new_paid, 0),
      status = new_status,
      payment_method = nullif(p_payment_method, ''),
      payment_reference = nullif(p_reference, ''),
      paiements = coalesce(paiements, '[]'::jsonb) || jsonb_build_array(
        jsonb_strip_nulls(jsonb_build_object(
          'date', p_payment_date,
          'montant', p_amount,
          'mode', nullif(p_payment_method, ''),
          'note', nullif(p_notes, '')
        ))
      )
  where id = invoice_row.id;

  return jsonb_build_object(
    'payment', to_jsonb(payment_row),
    'invoice', jsonb_build_object(
      'id', invoice_row.id,
      'montant_recu', least(new_paid, invoice_total),
      'montant_paye', least(new_paid, invoice_total),
      'reste_a_payer', greatest(invoice_total - new_paid, 0),
      'status', new_status
    )
  );
end;
$$;

revoke all on function public.record_invoice_payment(uuid, numeric, date, text, text, text) from public;
grant execute on function public.record_invoice_payment(uuid, numeric, date, text, text, text) to authenticated;

-- Prevent any future client from recreating a paid/partial summary without a
-- confirmed collection row. Atomic payment RPCs insert evidence first.
create or replace function public.require_invoice_payment_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  confirmed_paid numeric;
  new_summary numeric;
begin
  if coalesce(new.invoice_type, 'facture') <> 'facture' then
    return new;
  end if;

  new_summary := greatest(coalesce(new.montant_recu, 0), coalesce(new.montant_paye, 0));
  if new_summary > greatest(coalesce(old.montant_recu, 0), coalesce(old.montant_paye, 0))
     or (new.status::text = 'paid' and old.status::text <> 'paid') then
    select coalesce(sum(montant), 0)
    into confirmed_paid
    from public.invoice_payments
    where invoice_id = new.id
      and allocation_status = 'confirmed'
      and payment_type = 'encaissement';

    if new_summary > confirmed_paid + 0.01
       or (new.status::text = 'paid' and confirmed_paid < coalesce(new.total, 0) - 0.01) then
      raise exception 'confirmed_payment_evidence_required';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists require_invoice_payment_evidence_trigger on public.invoices;
create trigger require_invoice_payment_evidence_trigger
before update on public.invoices
for each row execute function public.require_invoice_payment_evidence();

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 106, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
