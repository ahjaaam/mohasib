-- Lightweight supplier-invoice controls: processing state, one-person approval,
-- and an append-only activity timeline.

alter table public.receipts
  add column if not exists control_status text not null default 'review',
  add column if not exists approval_status text not null default 'not_requested',
  add column if not exists approver_id uuid references auth.users(id) on delete set null,
  add column if not exists approval_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approval_decided_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists control_checks jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.receipts add constraint receipts_control_status_check
    check (control_status in ('review', 'recorded', 'paid'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.receipts add constraint receipts_approval_status_check
    check (approval_status in ('not_requested', 'pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

update public.receipts
set control_status = case when status = 'matched' then 'recorded' else 'review' end
where control_status is null
   or (status = 'matched' and control_status = 'review');

create index if not exists idx_receipts_control_status on public.receipts(control_status);
create index if not exists idx_receipts_approver on public.receipts(approver_id, approval_status);

create table if not exists public.receipt_control_events (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_receipt_control_events_receipt
  on public.receipt_control_events(receipt_id, created_at desc);

alter table public.receipt_control_events enable row level security;

insert into public.receipt_control_events(receipt_id, actor_id, event_type, message, metadata, created_at)
select receipt.id, null, 'received', 'Document reçu et placé dans la file de vérification.',
       jsonb_build_object('source', 'migration_backfill'), receipt.created_at
from public.receipts receipt
where not exists (
  select 1 from public.receipt_control_events event where event.receipt_id = receipt.id
);

create or replace function public.record_receipt_control_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
  event_message text;
begin
  if tg_op = 'INSERT' then
    event_name := 'received';
    event_message := 'Document reçu et placé dans la file de vérification.';
  elsif old.approval_status is distinct from new.approval_status then
    event_name := 'approval_' || new.approval_status;
    event_message := case new.approval_status
      when 'pending' then 'Validation demandée.'
      when 'approved' then 'Document validé.'
      when 'rejected' then 'Validation refusée.'
      else 'Demande de validation annulée.'
    end;
  elsif old.control_status is distinct from new.control_status then
    event_name := 'status_' || new.control_status;
    event_message := case new.control_status
      when 'recorded' then 'Document comptabilisé.'
      when 'paid' then 'Document marqué comme payé.'
      else 'Document renvoyé en vérification.'
    end;
  elsif old.status is distinct from new.status then
    event_name := 'receipt_' || new.status;
    event_message := case new.status
      when 'matched' then 'Document traité.'
      when 'ignored' then 'Document ignoré.'
      else 'Document récupéré pour vérification.'
    end;
  else
    return new;
  end if;

  insert into public.receipt_control_events(receipt_id, actor_id, event_type, message, metadata)
  values (new.id, auth.uid(), event_name, event_message, jsonb_build_object('source', 'receipt_trigger'));
  return new;
end;
$$;

drop trigger if exists receipt_control_activity on public.receipts;
create trigger receipt_control_activity
after insert or update of status, control_status, approval_status on public.receipts
for each row execute function public.record_receipt_control_event();

create or replace function public.sync_receipt_control_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'matched' and old.status is distinct from new.status and new.control_status = 'review' then
    new.control_status := 'recorded';
  elsif new.status = 'pending' and old.status is distinct from new.status and old.control_status <> 'paid' then
    new.control_status := 'review';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_receipt_control_status on public.receipts;
create trigger sync_receipt_control_status
before update of status on public.receipts
for each row execute function public.sync_receipt_control_status();
