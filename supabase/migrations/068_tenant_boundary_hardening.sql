-- Defense-in-depth tenant hardening for payroll and append-only audit data.

do $$
begin
  if to_regclass('public.cnss_declarations') is not null then
    execute 'alter table public.cnss_declarations enable row level security';
    execute 'drop policy if exists "Users manage own cnss declarations" on public.cnss_declarations';
    execute $policy$
      create policy "Users manage own cnss declarations"
        on public.cnss_declarations
        for all
        to authenticated
        using (user_id = auth.uid())
        with check (
          user_id = auth.uid()
          and (
            company_id is null
            or company_id in (
              select id from public.companies where user_id = auth.uid()
            )
          )
        )
    $policy$;
  end if;

  if to_regclass('public.accounting_events') is not null then
    execute 'drop policy if exists "Insert events" on public.accounting_events';
    execute 'drop policy if exists "Authenticated users can insert accounting events" on public.accounting_events';
    execute $policy$
      create policy "Authenticated users can insert accounting events"
        on public.accounting_events
        for insert
        to authenticated
        with check (
          triggered_by = auth.uid()
          and (
            company_id is null
            or company_id in (
              select id from public.companies where user_id = auth.uid()
            )
          )
          and (
            dossier_id is null
            or dossier_id in (
              select id from public.dossiers where fiduciaire_user_id = auth.uid()
            )
          )
        )
    $policy$;
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute 'drop policy if exists "Users can insert scoped audit logs" on public.audit_logs';
    execute 'drop policy if exists "System can insert logs" on public.audit_logs';
    execute 'drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs';
    execute $policy$
      create policy "Authenticated users can insert audit logs"
        on public.audit_logs
        for insert
        to authenticated
        with check (
          user_id = auth.uid()
          and (
            company_id is null
            or company_id in (
              select id from public.companies where user_id = auth.uid()
            )
          )
          and (
            dossier_id is null
            or dossier_id in (
              select id from public.dossiers where fiduciaire_user_id = auth.uid()
            )
          )
        )
    $policy$;
  end if;

  if to_regclass('public.leave_types') is not null then
    execute 'drop policy if exists "Users manage own leave types" on public.leave_types';
    execute 'drop policy if exists "Users can read leave types" on public.leave_types';
    execute 'drop policy if exists "Users can insert leave types" on public.leave_types';
    execute 'drop policy if exists "Users can update leave types" on public.leave_types';
    execute 'drop policy if exists "Users can delete leave types" on public.leave_types';

    execute $policy$
      create policy "Users can read leave types"
        on public.leave_types
        for select
        to authenticated
        using (
          is_default = true
          or company_id in (
            select id from public.companies where user_id = auth.uid()
          )
          or dossier_id in (
            select id from public.dossiers where fiduciaire_user_id = auth.uid()
          )
        )
    $policy$;
    execute $policy$
      create policy "Users can insert leave types"
        on public.leave_types
        for insert
        to authenticated
        with check (
          is_default = false
          and (
            company_id in (
              select id from public.companies where user_id = auth.uid()
            )
            or dossier_id in (
              select id from public.dossiers where fiduciaire_user_id = auth.uid()
            )
          )
        )
    $policy$;
    execute $policy$
      create policy "Users can update leave types"
        on public.leave_types
        for update
        to authenticated
        using (
          is_default = false
          and (
            company_id in (
              select id from public.companies where user_id = auth.uid()
            )
            or dossier_id in (
              select id from public.dossiers where fiduciaire_user_id = auth.uid()
            )
          )
        )
        with check (
          is_default = false
          and (
            company_id in (
              select id from public.companies where user_id = auth.uid()
            )
            or dossier_id in (
              select id from public.dossiers where fiduciaire_user_id = auth.uid()
            )
          )
        )
    $policy$;
    execute $policy$
      create policy "Users can delete leave types"
        on public.leave_types
        for delete
        to authenticated
        using (
          is_default = false
          and (
            company_id in (
              select id from public.companies where user_id = auth.uid()
            )
            or dossier_id in (
              select id from public.dossiers where fiduciaire_user_id = auth.uid()
            )
          )
        )
    $policy$;
  end if;
end $$;
