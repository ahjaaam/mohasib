-- Many-to-many settlement links between money movements and commercial documents.
-- Ordered immediately after the transaction-source migration.
-- A transaction can settle several documents, and a document can be settled by
-- several transactions. Existing invoice_payments rows remain valid.

do $$
begin
  alter type public.invoice_status add value if not exists 'partiellement_payee';
exception
  when duplicate_object then null;
end $$;

alter table public.invoices
  add column if not exists montant_recu numeric(12, 2) not null default 0,
  add column if not exists paiements jsonb not null default '[]'::jsonb;

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  inbox_item_id uuid references public.receipts(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  montant numeric(12, 2) not null,
  date_paiement date not null,
  mode_paiement text,
  reference text,
  notes text,
  payment_type text not null default 'encaissement',
  created_at timestamptz not null default now()
);

alter table public.invoice_payments
  add column if not exists invoice_id uuid references public.invoices(id) on delete cascade,
  add column if not exists inbox_item_id uuid references public.receipts(id) on delete cascade,
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists dossier_id uuid references public.dossiers(id) on delete cascade,
  add column if not exists montant numeric(12, 2),
  add column if not exists date_paiement date,
  add column if not exists mode_paiement text,
  add column if not exists reference text,
  add column if not exists notes text,
  add column if not exists payment_type text default 'encaissement',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists bank_line_id uuid references public.bank_statement_lines(id) on delete set null,
  add column if not exists allocation_status text not null default 'confirmed',
  add column if not exists match_confidence numeric(5, 4),
  add column if not exists match_method text,
  add column if not exists match_evidence jsonb not null default '{}'::jsonb,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz;

update public.invoice_payments
set allocation_status = 'confirmed',
    confirmed_at = coalesce(confirmed_at, created_at, now())
where allocation_status is null
   or allocation_status not in ('suggested', 'confirmed', 'rejected');

alter table public.invoice_payments
  drop constraint if exists invoice_payments_document_check,
  drop constraint if exists invoice_payments_amount_check,
  drop constraint if exists invoice_payments_allocation_status_check;

alter table public.invoice_payments
  add constraint invoice_payments_document_check
    check (num_nonnulls(invoice_id, inbox_item_id) = 1) not valid,
  add constraint invoice_payments_amount_check
    check (montant > 0) not valid,
  add constraint invoice_payments_allocation_status_check
    check (allocation_status in ('suggested', 'confirmed', 'rejected'));

create index if not exists idx_invoice_payments_transaction
  on public.invoice_payments(transaction_id, allocation_status);
create index if not exists idx_invoice_payments_invoice
  on public.invoice_payments(invoice_id, allocation_status);
create index if not exists idx_invoice_payments_inbox
  on public.invoice_payments(inbox_item_id, allocation_status);
create index if not exists idx_invoice_payments_bank_line
  on public.invoice_payments(bank_line_id);
create index if not exists idx_invoice_payments_company
  on public.invoice_payments(company_id);
create index if not exists idx_invoice_payments_dossier
  on public.invoice_payments(dossier_id);

alter table public.invoice_payments enable row level security;

drop policy if exists "Users manage scoped invoice payments" on public.invoice_payments;
drop policy if exists "Members read payment allocations" on public.invoice_payments;
drop policy if exists "Members create payment allocations" on public.invoice_payments;
drop policy if exists "Members update payment allocations" on public.invoice_payments;
drop policy if exists "Members delete payment allocations" on public.invoice_payments;

create policy "Members read payment allocations"
  on public.invoice_payments for select
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

create policy "Members create payment allocations"
  on public.invoice_payments for insert
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

create policy "Members update payment allocations"
  on public.invoice_payments for update
  using (
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
  )
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

create policy "Members delete payment allocations"
  on public.invoice_payments for delete
  using (
    company_id in (
      select company.id
      from public.companies company
      where public.member_has_permission('accounting', 'delete', company.user_id)
    )
    or dossier_id in (
      select dossier.id
      from public.dossiers dossier
      where public.member_has_permission('accounting', 'delete', dossier.fiduciaire_user_id, dossier.id)
    )
  );

create or replace function public.confirm_payment_allocations(
  p_transaction_id uuid,
  p_allocations jsonb,
  p_match_method text default 'manual'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  transaction_row public.transactions%rowtype;
  invoice_row public.invoices%rowtype;
  receipt_row public.receipts%rowtype;
  allocation jsonb;
  document_type text;
  document_id uuid;
  allocation_amount numeric;
  requested_total numeric;
  existing_total numeric;
  document_paid numeric;
  document_total numeric;
  company_id_value uuid;
  payment_id uuid;
  result_rows jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'allocation_list_required';
  end if;

  select *
  into transaction_row
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction_not_found';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_allocations) as item(value)
    group by value->>'document_type', value->>'document_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate_document_allocation';
  end if;

  select coalesce(sum((value->>'amount')::numeric), 0)
  into requested_total
  from jsonb_array_elements(p_allocations) as item(value);

  if requested_total <= 0 then
    raise exception 'allocation_amount_invalid';
  end if;

  select coalesce(sum(montant), 0)
  into existing_total
  from public.invoice_payments
  where transaction_id = p_transaction_id
    and allocation_status = 'confirmed';

  if existing_total + requested_total > abs(transaction_row.amount) + 0.01 then
    raise exception 'allocation_exceeds_transaction';
  end if;

  if transaction_row.dossier_id is null then
    select id
    into company_id_value
    from public.companies
    where user_id = transaction_row.user_id
    order by created_at
    limit 1;
  end if;

  for allocation in
    select value from jsonb_array_elements(p_allocations) as item(value)
  loop
    document_type := allocation->>'document_type';
    document_id := (allocation->>'document_id')::uuid;
    allocation_amount := (allocation->>'amount')::numeric;

    if allocation_amount <= 0 then
      raise exception 'allocation_amount_invalid';
    end if;

    if document_type = 'client_invoice' then
      if transaction_row.type <> 'income' then
        raise exception 'client_invoice_requires_income';
      end if;

      select *
      into invoice_row
      from public.invoices
      where id = document_id
      for update;

      if not found
         or invoice_row.dossier_id is distinct from transaction_row.dossier_id
         or (transaction_row.dossier_id is null and invoice_row.user_id <> transaction_row.user_id) then
        raise exception 'invoice_not_found_or_out_of_scope';
      end if;

      document_paid := coalesce(invoice_row.montant_recu, 0);
      document_total := abs(coalesce(invoice_row.total, 0));
      if document_paid + allocation_amount > document_total + 0.01 then
        raise exception 'allocation_exceeds_document';
      end if;

      insert into public.invoice_payments (
        invoice_id, company_id, dossier_id, montant, date_paiement,
        mode_paiement, reference, payment_type, transaction_id, bank_line_id,
        allocation_status, match_confidence, match_method, match_evidence,
        confirmed_by, confirmed_at
      ) values (
        invoice_row.id, company_id_value, transaction_row.dossier_id,
        allocation_amount, transaction_row.date, transaction_row.payment_method,
        coalesce(transaction_row.bank_reference, transaction_row.reference),
        'encaissement', transaction_row.id, transaction_row.bank_line_id,
        'confirmed', 1, coalesce(p_match_method, 'manual'),
        jsonb_build_object('transaction_description', transaction_row.description),
        auth.uid(), now()
      )
      returning id into payment_id;

      document_paid := document_paid + allocation_amount;
      update public.invoices
      set montant_recu = document_paid,
          paiements = coalesce(paiements, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'date', transaction_row.date,
              'montant', allocation_amount,
              'mode', coalesce(transaction_row.payment_method, 'Virement'),
              'note', 'Affectation depuis la transaction ' || transaction_row.description
            )
          )
      where id = invoice_row.id;

      if document_paid >= document_total - 0.01 then
        update public.invoices
        set status = 'paid'
        where id = invoice_row.id;
      else
        -- Dynamic SQL avoids using the enum value in the same migration
        -- transaction that introduces it.
        execute
          'update public.invoices set status = ''partiellement_payee'' where id = $1'
          using invoice_row.id;
      end if;

      result_rows := result_rows || jsonb_build_array(
        jsonb_build_object(
          'id', payment_id,
          'document_type', document_type,
          'document_id', document_id,
          'amount', allocation_amount
        )
      );
    elsif document_type = 'supplier_document' then
      if transaction_row.type <> 'expense' then
        raise exception 'supplier_document_requires_expense';
      end if;

      select *
      into receipt_row
      from public.receipts
      where id = document_id
      for update;

      if not found
         or receipt_row.dossier_id is distinct from transaction_row.dossier_id
         or (transaction_row.dossier_id is null and receipt_row.user_id <> transaction_row.user_id) then
        raise exception 'supplier_document_not_found_or_out_of_scope';
      end if;

      document_paid := coalesce((receipt_row.ocr_data->>'montant_paye')::numeric, 0);
      document_total := abs(coalesce((receipt_row.ocr_data->>'amount')::numeric, 0));
      if document_total <= 0 then
        raise exception 'supplier_document_amount_missing';
      end if;
      if document_paid + allocation_amount > document_total + 0.01 then
        raise exception 'allocation_exceeds_document';
      end if;

      insert into public.invoice_payments (
        inbox_item_id, company_id, dossier_id, montant, date_paiement,
        mode_paiement, reference, payment_type, transaction_id, bank_line_id,
        allocation_status, match_confidence, match_method, match_evidence,
        confirmed_by, confirmed_at
      ) values (
        receipt_row.id, company_id_value, transaction_row.dossier_id,
        allocation_amount, transaction_row.date, transaction_row.payment_method,
        coalesce(transaction_row.bank_reference, transaction_row.reference),
        'decaissement', transaction_row.id, transaction_row.bank_line_id,
        'confirmed', 1, coalesce(p_match_method, 'manual'),
        jsonb_build_object('transaction_description', transaction_row.description),
        auth.uid(), now()
      )
      returning id into payment_id;

      document_paid := document_paid + allocation_amount;
      update public.receipts
      set ocr_data = coalesce(ocr_data, '{}'::jsonb) || jsonb_build_object(
        'montant_paye', document_paid,
        'payment_status', case
          when document_paid >= document_total - 0.01 then 'paid'
          else 'partial'
        end
      )
      where id = receipt_row.id;

      result_rows := result_rows || jsonb_build_array(
        jsonb_build_object(
          'id', payment_id,
          'document_type', document_type,
          'document_id', document_id,
          'amount', allocation_amount
        )
      );
    else
      raise exception 'unsupported_document_type';
    end if;
  end loop;

  return jsonb_build_object(
    'transaction_id', transaction_row.id,
    'allocated_total', existing_total + requested_total,
    'transaction_amount', abs(transaction_row.amount),
    'allocations', result_rows
  );
end;
$$;

revoke all on function public.confirm_payment_allocations(uuid, jsonb, text) from public;
grant execute on function public.confirm_payment_allocations(uuid, jsonb, text) to authenticated;
