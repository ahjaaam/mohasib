-- Keep payment records in the same scope as the paid document.
do $$
begin
  if to_regclass('public.invoice_payments') is not null then
    alter table public.invoice_payments
      add column if not exists dossier_id uuid references public.dossiers(id) on delete cascade;
    create index if not exists idx_invoice_payments_dossier on public.invoice_payments(dossier_id);
    alter table public.invoice_payments enable row level security;
    drop policy if exists "Users manage scoped invoice payments" on public.invoice_payments;
    create policy "Users manage scoped invoice payments" on public.invoice_payments
      for all
      using (
        company_id in (select id from public.companies where user_id = auth.uid())
        or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
      )
      with check (
        company_id in (select id from public.companies where user_id = auth.uid())
        or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
      );
  end if;
end $$;
