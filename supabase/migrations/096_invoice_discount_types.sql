alter table public.invoices
  add column if not exists discount_type text,
  add column if not exists discount_mode text,
  add column if not exists discount_value numeric(12, 4) not null default 0,
  add column if not exists discount_amount numeric(12, 2) not null default 0;

alter table public.invoices
  drop constraint if exists invoices_discount_type_check,
  add constraint invoices_discount_type_check check (
    discount_type is null or discount_type in ('remise_commerciale', 'rabais', 'reduction', 'ristourne', 'escompte')
  ),
  drop constraint if exists invoices_discount_mode_check,
  add constraint invoices_discount_mode_check check (
    discount_mode is null or discount_mode in ('percent', 'amount')
  ),
  drop constraint if exists invoices_discount_amount_nonnegative,
  add constraint invoices_discount_amount_nonnegative check (discount_amount >= 0),
  drop constraint if exists invoices_discount_value_nonnegative,
  add constraint invoices_discount_value_nonnegative check (discount_value >= 0);

comment on column public.invoices.discount_amount is
  'Reduction amount excluding VAT. Commercial discounts and settlement discounts are booked separately.';

