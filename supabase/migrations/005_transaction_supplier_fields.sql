-- Supplier fiscal fields for transactions (TVA deduction / DGI)
alter table public.transactions
  add column if not exists fournisseur      text,
  add column if not exists if_fournisseur   text,
  add column if not exists ice_fournisseur  text,
  add column if not exists mode_paiement    text,
  add column if not exists date_paiement    date;
