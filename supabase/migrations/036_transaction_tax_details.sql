-- Store actual supplier tax details so exports do not need to assume a flat rate.
alter table public.transactions
  add column if not exists tax_rate numeric,
  add column if not exists tax_amount numeric,
  add column if not exists amount_ht numeric;
