-- Effective statutory choices used by VAT, payroll, and release health checks.

alter table public.companies
  add column if not exists tva_tax_point text not null default 'cash',
  add column if not exists payroll_amo_regime text not null default 'standard',
  add column if not exists payroll_tfp_exempt boolean not null default false;

alter table public.dossiers
  add column if not exists tva_tax_point text not null default 'cash',
  add column if not exists payroll_amo_regime text not null default 'standard',
  add column if not exists payroll_tfp_exempt boolean not null default false;

do $$ begin
  alter table public.companies add constraint companies_tva_tax_point_check
    check (tva_tax_point in ('cash', 'debit'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dossiers add constraint dossiers_tva_tax_point_check
    check (tva_tax_point in ('cash', 'debit'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.companies add constraint companies_payroll_amo_regime_check
    check (payroll_amo_regime in ('standard', 'solidarity_only'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dossiers add constraint dossiers_payroll_amo_regime_check
    check (payroll_amo_regime in ('standard', 'solidarity_only'));
exception when duplicate_object then null;
end $$;

create table if not exists public.app_schema_version (
  singleton boolean primary key default true check (singleton),
  version integer not null,
  applied_at timestamptz not null default now()
);

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 104, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

alter table public.app_schema_version enable row level security;
revoke all on table public.app_schema_version from anon, authenticated;
