-- ── Bank Statements ──────────────────────────────────────────────────────────

create table if not exists public.bank_statements (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies,
  user_id          uuid references auth.users,
  bank_name        text,
  account_number   text,
  period_start     date,
  period_end       date,
  opening_balance  numeric default 0,
  closing_balance  numeric default 0,
  file_url         text,
  file_name        text,
  imported_at      timestamptz default now(),
  status           text default 'pending',
  created_at       timestamptz default now()
);

-- ── Bank Statement Lines ──────────────────────────────────────────────────────

create table if not exists public.bank_statement_lines (
  id                 uuid primary key default gen_random_uuid(),
  statement_id       uuid references public.bank_statements on delete cascade,
  company_id         uuid references public.companies,
  date               date not null,
  description        text,
  reference          text,
  amount             numeric not null,
  balance_after      numeric,
  status             text default 'unmatched',
  transaction_id     uuid references public.transactions,
  match_confidence   numeric,
  match_reason       text,
  matched_at         timestamptz,
  matched_by         text,
  created_at         timestamptz default now()
);

-- ── Add reconciliation fields to transactions ─────────────────────────────────

alter table public.transactions
  add column if not exists reconciled               boolean default false,
  add column if not exists reconciled_at            timestamptz,
  add column if not exists bank_line_id             uuid references public.bank_statement_lines,
  add column if not exists reconciliation_status    text default 'unreconciled';

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.bank_statements       enable row level security;
alter table public.bank_statement_lines  enable row level security;

create policy "Users see own statements"
  on public.bank_statements for all
  using (user_id = auth.uid());

create policy "Users see own statement lines"
  on public.bank_statement_lines for all
  using (company_id in (
    select id from public.companies where user_id = auth.uid()
  ));
