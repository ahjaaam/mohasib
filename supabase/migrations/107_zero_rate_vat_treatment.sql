-- Keep 0% invoice turnover visible and explicitly classified for VAT returns.

alter table public.invoices
  add column if not exists vat_treatment text;

alter table public.invoices
  drop constraint if exists invoices_vat_treatment_check;
alter table public.invoices
  add constraint invoices_vat_treatment_check check (
    vat_treatment is null or vat_treatment in (
      'out_of_scope',
      'exempt_without_deduction',
      'exempt_with_deduction',
      'suspension'
    )
  );

create or replace function public.validate_invoice_vat_treatment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_zero_rate boolean;
  company_id_value uuid;
  tax_point_value text;
  treatment_period_locked boolean := false;
begin
  if coalesce(new.invoice_type, 'facture') not in ('facture', 'avoir_client') then
    return new;
  end if;

  has_zero_rate := coalesce(new.tax_rate, 0) = 0 or exists (
    select 1
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) item
    where (jsonb_typeof(item->'tva_rate') = 'number' and (item->>'tva_rate')::numeric = 0)
       or (jsonb_typeof(item->'tva_rate') = 'string' and trim(item->>'tva_rate') in ('0', '0.0', '0.00'))
  );

  if new.status::text not in ('draft', 'cancelled')
     and has_zero_rate
     and new.vat_treatment is null then
    raise exception 'zero_rate_vat_treatment_required';
  end if;

  if tg_op = 'UPDATE'
     and new.vat_treatment is distinct from old.vat_treatment
     and old.status::text not in ('draft', 'cancelled') then
    if new.dossier_id is not null then
      select coalesce(dossier.tva_tax_point, 'cash')
      into tax_point_value
      from public.dossiers dossier
      where dossier.id = new.dossier_id;
    else
      select company.id, coalesce(company.tva_tax_point, 'cash')
      into company_id_value, tax_point_value
      from public.companies company
      where company.user_id = new.user_id
      order by company.created_at
      limit 1;
    end if;

    if tax_point_value = 'debit' then
      select exists (
        select 1 from public.accounting_periods period
        where period.is_locked = true
          and period.is_unlocked = false
          and period.mois = extract(month from new.issue_date)::integer
          and period.annee = extract(year from new.issue_date)::integer
          and (
            (new.dossier_id is not null and period.dossier_id = new.dossier_id)
            or (new.dossier_id is null and period.company_id = company_id_value)
          )
      ) into treatment_period_locked;
    else
      select exists (
        select 1
        from public.invoice_payments payment
        join public.accounting_periods period
          on period.mois = extract(month from payment.date_paiement)::integer
         and period.annee = extract(year from payment.date_paiement)::integer
         and (
           (new.dossier_id is not null and period.dossier_id = new.dossier_id)
           or (new.dossier_id is null and period.company_id = company_id_value)
         )
        where payment.invoice_id = new.id
          and payment.allocation_status = 'confirmed'
          and payment.payment_type = 'encaissement'
          and period.is_locked = true
          and period.is_unlocked = false
      ) into treatment_period_locked;
    end if;

    if treatment_period_locked then
      raise exception 'vat_treatment_period_locked';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_invoice_vat_treatment_trigger on public.invoices;
create trigger validate_invoice_vat_treatment_trigger
before insert or update on public.invoices
for each row execute function public.validate_invoice_vat_treatment();

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 107, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
