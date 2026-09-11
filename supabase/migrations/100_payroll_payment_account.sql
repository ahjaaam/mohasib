begin;

create or replace function public.normalize_payroll_payment_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  if new.source_type = 'salary_payment' and new.credit > 0 then
    select lower(coalesce(mode_paiement, 'virement')) into v_mode
    from public.bulletins_paie where id = new.source_id;
    if v_mode in ('espèces', 'especes', 'caisse', 'cash') then
      new.compte := '5161';
      new.compte_label := 'Caisse';
      new.journal := 'CA';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_payroll_payment_account_trigger on public.ecritures_comptables;
create trigger normalize_payroll_payment_account_trigger
before insert on public.ecritures_comptables
for each row execute function public.normalize_payroll_payment_account();

commit;
