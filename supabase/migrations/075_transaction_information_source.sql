-- Make the origin of every transaction explicit.
-- `bank_import` covers transactions imported from, or created from, a bank statement.
-- All other existing transactions were entered through Mohasib's manual workflows.

alter table public.transactions
  add column if not exists source text;

update public.transactions
set source = case
  when bank_line_id is not null then 'bank_import'
  else 'manual'
end
where source is null
   or source not in ('manual', 'bank_import');

alter table public.transactions
  alter column source set default 'manual',
  alter column source set not null;

alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'bank_import'));

create index if not exists idx_transactions_source
  on public.transactions(source);
