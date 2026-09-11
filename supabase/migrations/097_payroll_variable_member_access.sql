-- Payroll detail tables originally authorized only rows carrying a company_id
-- owned directly by auth.uid(). Main-account employees can legitimately have a
-- null company_id, and delegated payroll users act through user_memberships.
-- Authorize these rows from their employee/scope relationship instead.

drop policy if exists "Users manage own employee primes" on public.employee_primes;
drop policy if exists "Payroll users read employee primes" on public.employee_primes;
drop policy if exists "Payroll users manage employee primes" on public.employee_primes;

create policy "Payroll users read employee primes"
  on public.employee_primes for select to authenticated
  using (
    employee_id in (
      select employee.id
      from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (
          select dossier.id from public.dossiers dossier
          where dossier.fiduciaire_user_id = auth.uid()
        )
        or public.member_has_permission(
          'bulletin_paie',
          'read',
          employee.user_id,
          employee.dossier_id
        )
        or public.member_has_permission(
          'salary',
          'read',
          employee.user_id,
          employee.dossier_id
        )
    )
  );

create policy "Payroll users manage employee primes"
  on public.employee_primes for all to authenticated
  using (
    employee_id in (
      select employee.id
      from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (
          select dossier.id from public.dossiers dossier
          where dossier.fiduciaire_user_id = auth.uid()
        )
        or public.member_has_permission(
          'bulletin_paie',
          'validate',
          employee.user_id,
          employee.dossier_id
        )
    )
  )
  with check (
    employee_id in (
      select employee.id
      from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (
          select dossier.id from public.dossiers dossier
          where dossier.fiduciaire_user_id = auth.uid()
        )
        or public.member_has_permission(
          'bulletin_paie',
          'validate',
          employee.user_id,
          employee.dossier_id
        )
    )
  );

-- Hours and leave entries use the same employee ownership model and otherwise
-- fail for the same null-company/member cases.
drop policy if exists "Users manage own employee hours" on public.employee_heures;
drop policy if exists "Payroll users read employee hours" on public.employee_heures;
drop policy if exists "Payroll users manage employee hours" on public.employee_heures;

create policy "Payroll users read employee hours"
  on public.employee_heures for select to authenticated
  using (
    employee_id in (
      select employee.id from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (select dossier.id from public.dossiers dossier where dossier.fiduciaire_user_id = auth.uid())
        or public.member_has_permission('bulletin_paie', 'read', employee.user_id, employee.dossier_id)
        or public.member_has_permission('salary', 'read', employee.user_id, employee.dossier_id)
    )
  );

create policy "Payroll users manage employee hours"
  on public.employee_heures for all to authenticated
  using (
    employee_id in (
      select employee.id from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (select dossier.id from public.dossiers dossier where dossier.fiduciaire_user_id = auth.uid())
        or public.member_has_permission('bulletin_paie', 'validate', employee.user_id, employee.dossier_id)
    )
  )
  with check (
    employee_id in (
      select employee.id from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (select dossier.id from public.dossiers dossier where dossier.fiduciaire_user_id = auth.uid())
        or public.member_has_permission('bulletin_paie', 'validate', employee.user_id, employee.dossier_id)
    )
  );

drop policy if exists "Users manage own employee leaves" on public.employee_leaves;
drop policy if exists "Payroll users read employee leaves" on public.employee_leaves;
drop policy if exists "Payroll users manage employee leaves" on public.employee_leaves;

create policy "Payroll users read employee leaves"
  on public.employee_leaves for select to authenticated
  using (
    employee_id in (
      select employee.id from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (select dossier.id from public.dossiers dossier where dossier.fiduciaire_user_id = auth.uid())
        or public.member_has_permission('bulletin_paie', 'read', employee.user_id, employee.dossier_id)
        or public.member_has_permission('salary', 'read', employee.user_id, employee.dossier_id)
    )
  );

create policy "Payroll users manage employee leaves"
  on public.employee_leaves for all to authenticated
  using (
    employee_id in (
      select employee.id from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (select dossier.id from public.dossiers dossier where dossier.fiduciaire_user_id = auth.uid())
        or public.member_has_permission('bulletin_paie', 'validate', employee.user_id, employee.dossier_id)
    )
  )
  with check (
    employee_id in (
      select employee.id from public.employees employee
      where
        (employee.user_id = auth.uid() and employee.dossier_id is null)
        or employee.dossier_id in (select dossier.id from public.dossiers dossier where dossier.fiduciaire_user_id = auth.uid())
        or public.member_has_permission('bulletin_paie', 'validate', employee.user_id, employee.dossier_id)
    )
  );

notify pgrst, 'reload schema';
