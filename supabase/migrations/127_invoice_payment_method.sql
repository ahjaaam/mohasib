alter table public.companies
  add column if not exists invoice_payment_method text not null default 'Virement bancaire';

alter table public.dossiers
  add column if not exists invoice_payment_method text not null default 'Virement bancaire';

alter table public.invoices
  add column if not exists payment_method text;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 127, now())
on conflict (singleton) do update set
  version = excluded.version,
  applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
