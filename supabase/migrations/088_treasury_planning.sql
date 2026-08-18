-- Treasury planning: cash accounts, internal transfers and weekly budgets.

create table if not exists public.treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  name text not null,
  account_type text not null default 'bank',
  bank_name text,
  currency text not null default 'MAD',
  current_balance numeric(15, 2) not null default 0,
  overdraft_limit numeric(15, 2) not null default 0,
  financing_limit numeric(15, 2) not null default 0,
  financing_used numeric(15, 2) not null default 0,
  annual_rate numeric(7, 4),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_accounts_scope_check check (num_nonnulls(company_id, dossier_id) = 1),
  constraint treasury_accounts_type_check check (account_type in ('bank', 'cash', 'credit', 'financing')),
  constraint treasury_accounts_limits_check check (overdraft_limit >= 0 and financing_limit >= 0 and financing_used >= 0)
);

create table if not exists public.treasury_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  from_account_id uuid not null references public.treasury_accounts(id) on delete restrict,
  to_account_id uuid not null references public.treasury_accounts(id) on delete restrict,
  amount numeric(15, 2) not null,
  transfer_date date not null default current_date,
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint treasury_transfers_scope_check check (num_nonnulls(company_id, dossier_id) = 1),
  constraint treasury_transfers_accounts_check check (from_account_id <> to_account_id),
  constraint treasury_transfers_amount_check check (amount > 0)
);

create table if not exists public.treasury_weekly_budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  week_start date not null,
  inflow_budget numeric(15, 2) not null default 0,
  outflow_budget numeric(15, 2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_weekly_budgets_scope_check check (num_nonnulls(company_id, dossier_id) = 1),
  constraint treasury_weekly_budgets_amounts_check check (inflow_budget >= 0 and outflow_budget >= 0)
);

create unique index if not exists treasury_weekly_budgets_company_week
  on public.treasury_weekly_budgets(company_id, week_start) where company_id is not null;
create unique index if not exists treasury_weekly_budgets_dossier_week
  on public.treasury_weekly_budgets(dossier_id, week_start) where dossier_id is not null;
create index if not exists treasury_accounts_company on public.treasury_accounts(company_id, is_active);
create index if not exists treasury_accounts_dossier on public.treasury_accounts(dossier_id, is_active);
create index if not exists treasury_transfers_company_date on public.treasury_transfers(company_id, transfer_date desc);
create index if not exists treasury_transfers_dossier_date on public.treasury_transfers(dossier_id, transfer_date desc);

alter table public.treasury_accounts enable row level security;
alter table public.treasury_transfers enable row level security;
alter table public.treasury_weekly_budgets enable row level security;

create policy "Members read treasury accounts" on public.treasury_accounts for select using (
  company_id in (select id from public.companies where public.member_has_permission('report', 'read', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('report', 'read', fiduciaire_user_id, id))
);
create policy "Members manage treasury accounts" on public.treasury_accounts for all using (
  company_id in (select id from public.companies where public.member_has_permission('accounting', 'create', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('accounting', 'create', fiduciaire_user_id, id))
) with check (
  company_id in (select id from public.companies where public.member_has_permission('accounting', 'create', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('accounting', 'create', fiduciaire_user_id, id))
);

create policy "Members read treasury transfers" on public.treasury_transfers for select using (
  company_id in (select id from public.companies where public.member_has_permission('report', 'read', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('report', 'read', fiduciaire_user_id, id))
);
create policy "Members create treasury transfers" on public.treasury_transfers for insert with check (
  company_id in (select id from public.companies where public.member_has_permission('accounting', 'create', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('accounting', 'create', fiduciaire_user_id, id))
);

create policy "Members read treasury budgets" on public.treasury_weekly_budgets for select using (
  company_id in (select id from public.companies where public.member_has_permission('report', 'read', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('report', 'read', fiduciaire_user_id, id))
);
create policy "Members manage treasury budgets" on public.treasury_weekly_budgets for all using (
  company_id in (select id from public.companies where public.member_has_permission('accounting', 'create', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('accounting', 'create', fiduciaire_user_id, id))
) with check (
  company_id in (select id from public.companies where public.member_has_permission('accounting', 'create', user_id))
  or dossier_id in (select id from public.dossiers where public.member_has_permission('accounting', 'create', fiduciaire_user_id, id))
);

create or replace function public.apply_treasury_transfer()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_scope record;
  target_scope record;
begin
  select company_id, dossier_id into source_scope from public.treasury_accounts where id = new.from_account_id for update;
  select company_id, dossier_id into target_scope from public.treasury_accounts where id = new.to_account_id for update;
  if source_scope.company_id is distinct from new.company_id
     or source_scope.dossier_id is distinct from new.dossier_id
     or target_scope.company_id is distinct from new.company_id
     or target_scope.dossier_id is distinct from new.dossier_id then
    raise exception 'Treasury transfer accounts must belong to the same workspace';
  end if;
  update public.treasury_accounts set current_balance = current_balance - new.amount, updated_at = now() where id = new.from_account_id;
  update public.treasury_accounts set current_balance = current_balance + new.amount, updated_at = now() where id = new.to_account_id;
  return new;
end;
$$;

drop trigger if exists apply_treasury_transfer_trigger on public.treasury_transfers;
create trigger apply_treasury_transfer_trigger
before insert on public.treasury_transfers
for each row execute function public.apply_treasury_transfer();
