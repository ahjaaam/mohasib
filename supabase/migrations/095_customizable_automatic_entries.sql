-- Per-workspace account mapping used for future automatic journal entries.
-- Existing journal rows remain immutable and keep the accounts used at booking time.
alter table public.companies
  add column if not exists accounting_settings jsonb not null default '{}'::jsonb;

alter table public.dossiers
  add column if not exists accounting_settings jsonb not null default '{}'::jsonb;

comment on column public.companies.accounting_settings is
  'Validated CGNC account overrides for future automatic journal entries.';

comment on column public.dossiers.accounting_settings is
  'Validated CGNC account overrides for future automatic journal entries in this dossier.';

