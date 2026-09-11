-- Controlled transaction workflow: imported/matched -> reviewed -> posted.
-- VAT is never deductible from a raw bank line without explicit document evidence.

alter table public.transactions
  add column if not exists workflow_status text not null default 'imported',
  add column if not exists vat_status text not null default 'pending_evidence',
  add column if not exists counterpart_account text,
  add column if not exists review_reason text,
  add column if not exists vat_evidence_receipt_id uuid references public.receipts(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists posted_by uuid references auth.users(id) on delete set null,
  add column if not exists posted_at timestamptz;

do $$ begin
  alter table public.transactions add constraint transactions_workflow_status_check
    check (workflow_status in ('imported', 'matched', 'reviewed', 'posted'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.transactions add constraint transactions_vat_status_check
    check (vat_status in ('not_applicable', 'pending_evidence', 'eligible', 'rejected'));
exception when duplicate_object then null;
end $$;

-- Existing journal entries remain posted. Confirmed allocations are matched.
-- Preserve the VAT classification already evidenced by historical journal
-- entries. A posted transaction must never be frozen in pending_evidence.
update public.transactions tx
set workflow_status = case
      when exists (
        select 1 from public.ecritures_comptables entry
        where entry.source_type = 'bank' and entry.source_id = tx.id
      ) then 'posted'
      when exists (
        select 1 from public.invoice_payments payment
        where payment.transaction_id = tx.id
          and payment.allocation_status = 'confirmed'
      ) then 'matched'
      else 'imported'
    end,
    vat_status = case
      when tx.type = 'income' then 'not_applicable'
      when exists (
        select 1 from public.ecritures_comptables entry
        where entry.source_type = 'bank'
          and entry.source_id = tx.id
          and (
            entry.compte like '3455%'
            or lower(coalesce(entry.libelle, '')) like 'tva déductible%'
          )
          and coalesce(entry.debit, 0) > 0
      ) and coalesce(tx.tax_amount, 0) > 0
        then 'eligible'
      when exists (
        select 1 from public.ecritures_comptables entry
        where entry.source_type = 'bank' and entry.source_id = tx.id
      ) then 'rejected'
      else 'pending_evidence'
    end,
    review_reason = case
      when tx.type = 'expense' and exists (
        select 1 from public.ecritures_comptables entry
        where entry.source_type = 'bank' and entry.source_id = tx.id
      ) and not exists (
        select 1 from public.ecritures_comptables entry
        where entry.source_type = 'bank'
          and entry.source_id = tx.id
          and (
            entry.compte like '3455%'
            or lower(coalesce(entry.libelle, '')) like 'tva déductible%'
          )
          and coalesce(entry.debit, 0) > 0
      ) then 'TVA historique non comptabilisée dans le journal : déduction rejetée'
      else tx.review_reason
    end,
    posted_at = case
      when exists (
        select 1 from public.ecritures_comptables entry
        where entry.source_type = 'bank' and entry.source_id = tx.id
      ) then coalesce(tx.posted_at, tx.updated_at, tx.created_at)
      else tx.posted_at
    end;

do $$ begin
  alter table public.transactions add constraint transactions_posted_vat_reviewed_check
    check (workflow_status <> 'posted' or vat_status <> 'pending_evidence');
exception when duplicate_object then null;
end $$;

create index if not exists idx_transactions_workflow_status
  on public.transactions(user_id, dossier_id, workflow_status, date desc);
create index if not exists idx_transactions_vat_status
  on public.transactions(user_id, dossier_id, vat_status, date desc);

create table if not exists public.transaction_review_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_workflow_status text,
  workflow_status text,
  previous_vat_status text,
  vat_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_transaction_review_events_transaction
  on public.transaction_review_events(transaction_id, created_at desc);

alter table public.transaction_review_events enable row level security;

drop policy if exists "Members read transaction review events" on public.transaction_review_events;
create policy "Members read transaction review events"
  on public.transaction_review_events for select
  using (
    exists (
      select 1 from public.transactions tx
      where tx.id = transaction_id
    )
  );

create or replace function public.record_transaction_review_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'imported';
  elsif old.workflow_status is distinct from new.workflow_status then
    event_name := 'workflow_' || new.workflow_status;
  elsif old.vat_status is distinct from new.vat_status then
    event_name := 'vat_' || new.vat_status;
  else
    return new;
  end if;

  insert into public.transaction_review_events(
    transaction_id, actor_id, event_type,
    previous_workflow_status, workflow_status,
    previous_vat_status, vat_status,
    metadata
  ) values (
    new.id, auth.uid(), event_name,
    case when tg_op = 'UPDATE' then old.workflow_status else null end,
    new.workflow_status,
    case when tg_op = 'UPDATE' then old.vat_status else null end,
    new.vat_status,
    jsonb_build_object('source', 'transaction_trigger')
  );
  return new;
end;
$$;

drop trigger if exists transaction_review_activity on public.transactions;
create trigger transaction_review_activity
after insert or update of workflow_status, vat_status on public.transactions
for each row execute function public.record_transaction_review_event();

-- A posted transaction cannot be silently returned to a draft state or have
-- the accounting/tax facts behind its journal entry changed. Reconciliation
-- metadata remains editable.
create or replace function public.protect_posted_transaction()
returns trigger
language plpgsql
as $$
begin
  if old.workflow_status = 'posted' and (
    new.workflow_status is distinct from old.workflow_status
    or new.type is distinct from old.type
    or new.amount is distinct from old.amount
    or new.date is distinct from old.date
    or new.counterpart_account is distinct from old.counterpart_account
    or new.vat_status is distinct from old.vat_status
    or new.tax_rate is distinct from old.tax_rate
    or new.tax_amount is distinct from old.tax_amount
    or new.amount_ht is distinct from old.amount_ht
    or new.vat_evidence_receipt_id is distinct from old.vat_evidence_receipt_id
  ) then
    raise exception 'posted_transaction_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_posted_transaction on public.transactions;
create trigger protect_posted_transaction
before update on public.transactions
for each row execute function public.protect_posted_transaction();
