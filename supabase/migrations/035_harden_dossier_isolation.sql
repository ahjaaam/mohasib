-- Enforce strict separation between main-account data and Comptable Pro dossiers.

-- Main-account policies must never grant access to dossier-scoped rows.
drop policy if exists "clients_own_data" on public.clients;
create policy "clients_own_data" on public.clients
  for all using (auth.uid() = user_id and dossier_id is null)
  with check (auth.uid() = user_id and dossier_id is null);

drop policy if exists "invoices_own_data" on public.invoices;
create policy "invoices_own_data" on public.invoices
  for all using (auth.uid() = user_id and dossier_id is null)
  with check (auth.uid() = user_id and dossier_id is null);

drop policy if exists "receipts_own_data" on public.receipts;
create policy "receipts_own_data" on public.receipts
  for all using (auth.uid() = user_id and dossier_id is null)
  with check (auth.uid() = user_id and dossier_id is null);

drop policy if exists "transactions_own_data" on public.transactions;
create policy "transactions_own_data" on public.transactions
  for all using (auth.uid() = user_id and dossier_id is null)
  with check (auth.uid() = user_id and dossier_id is null);

-- Dossier policies validate ownership on both reads and writes.
drop policy if exists "fiduciaire dossier clients" on public.clients;
create policy "fiduciaire dossier clients" on public.clients
  for all
  using (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()))
  with check (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()));

drop policy if exists "fiduciaire dossier invoices" on public.invoices;
create policy "fiduciaire dossier invoices" on public.invoices
  for all
  using (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()))
  with check (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()));

drop policy if exists "fiduciaire dossier receipts" on public.receipts;
create policy "fiduciaire dossier receipts" on public.receipts
  for all
  using (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()))
  with check (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()));

drop policy if exists "fiduciaire dossier transactions" on public.transactions;
create policy "fiduciaire dossier transactions" on public.transactions
  for all
  using (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()))
  with check (dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid()));

drop policy if exists "fiduciaire owns ecritures" on public.dossier_ecritures;
create policy "fiduciaire owns ecritures" on public.dossier_ecritures
  for all
  using (
    fiduciaire_user_id = auth.uid()
    and dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    fiduciaire_user_id = auth.uid()
    and dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

drop policy if exists "fiduciaire owns tva" on public.dossier_tva;
create policy "fiduciaire owns tva" on public.dossier_tva
  for all
  using (
    fiduciaire_user_id = auth.uid()
    and dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    fiduciaire_user_id = auth.uid()
    and dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

-- Payroll rows follow the same main-account/dossier boundary.
drop policy if exists "Users manage own employees" on public.employees;
create policy "Users manage own employees" on public.employees
  for all
  using (
    (user_id = auth.uid() and dossier_id is null)
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    (user_id = auth.uid() and dossier_id is null)
    or dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );

