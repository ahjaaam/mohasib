-- The application grants company and dossier owners accounting access directly.
-- The batch table introduced in 103 only grants members access, so owners
-- without a user_memberships row cannot confirm journal entries.

drop policy if exists "Owners read accounting booking batches" on public.accounting_booking_batches;
create policy "Owners read accounting booking batches"
  on public.accounting_booking_batches for select
  to authenticated
  using (
    exists (
      select 1 from public.companies company
      where company.id = accounting_booking_batches.company_id
        and company.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.dossiers dossier
      where dossier.id = accounting_booking_batches.dossier_id
        and dossier.fiduciaire_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners create accounting booking batches" on public.accounting_booking_batches;
create policy "Owners create accounting booking batches"
  on public.accounting_booking_batches for insert
  to authenticated
  with check (
    exists (
      select 1 from public.companies company
      where company.id = accounting_booking_batches.company_id
        and company.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.dossiers dossier
      where dossier.id = accounting_booking_batches.dossier_id
        and dossier.fiduciaire_user_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
