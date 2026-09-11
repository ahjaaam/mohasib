begin;

alter table public.bulletins_paie
  add column if not exists mutuelle_salarie numeric not null default 0,
  add column if not exists mutuelle_patronal numeric not null default 0,
  add column if not exists cimr_salarie numeric not null default 0,
  add column if not exists cimr_patronal numeric not null default 0;

alter table public.employees
  add column if not exists archived_at timestamptz;

update public.employees e
set company_id = c.id
from public.companies c
where e.company_id is null and e.dossier_id is null and c.user_id = e.user_id;

alter table public.cnss_declarations
  add column if not exists dossier_id uuid references public.dossiers(id) on delete cascade;
alter table public.cnss_declarations
  drop constraint if exists cnss_declarations_dossier_period_key,
  add constraint cnss_declarations_dossier_period_key unique(dossier_id, mois, annee);

alter table public.bulletins_paie
  drop constraint if exists bulletins_paie_employee_id_fkey;
alter table public.bulletins_paie
  add constraint bulletins_paie_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete restrict;

create or replace function public.protect_finalized_payroll()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.statut in ('validé', 'payé') then
    raise exception 'finalized_payroll_is_immutable';
  end if;
  if tg_op = 'UPDATE' and old.statut = 'payé' and new is distinct from old then
    raise exception 'paid_payroll_is_immutable';
  end if;
  if tg_op = 'UPDATE' and old.statut = 'validé' and new.statut not in ('validé', 'payé') then
    raise exception 'validated_payroll_cannot_be_reopened';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_finalized_payroll_trigger on public.bulletins_paie;
create trigger protect_finalized_payroll_trigger
before update or delete on public.bulletins_paie
for each row execute function public.protect_finalized_payroll();

create or replace function public.transition_payroll_bulletin(
  p_bulletin_id uuid,
  p_target_status text,
  p_payment_date date default null
)
returns public.bulletins_paie
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bulletins_paie;
  v_date date;
  v_employer_charges numeric;
  v_social_payable numeric;
  v_benefit_payable numeric;
begin
  select * into b from public.bulletins_paie where id = p_bulletin_id for update;
  if b.id is null then raise exception 'payroll_bulletin_not_found'; end if;
  if not (
    (b.company_id is not null and exists (select 1 from public.companies c where c.id = b.company_id and public.member_has_permission('bulletin_paie','validate',c.user_id)))
    or
    (b.dossier_id is not null and exists (select 1 from public.dossiers d where d.id = b.dossier_id and public.member_has_permission('bulletin_paie','validate',d.fiduciaire_user_id,d.id)))
  ) then raise exception 'payroll_permission_denied'; end if;
  if p_target_status = 'validé' and b.statut <> 'brouillon' then
    raise exception 'invalid_payroll_transition';
  elsif p_target_status = 'payé' and b.statut <> 'validé' then
    raise exception 'invalid_payroll_transition';
  elsif p_target_status not in ('validé', 'payé') then
    raise exception 'invalid_payroll_status';
  end if;

  v_date := coalesce(p_payment_date, make_date(b.annee, b.mois, 1) + interval '1 month - 1 day');
  v_employer_charges := b.cnss_patronal + b.amo_patronal + b.taxe_formation_pro
    + coalesce(b.mutuelle_patronal, 0) + coalesce(b.cimr_patronal, 0);
  v_social_payable := b.cnss_salarie + b.amo_salarie + b.cnss_patronal + b.amo_patronal + b.taxe_formation_pro;
  v_benefit_payable := coalesce(b.mutuelle_salarie, 0) + coalesce(b.mutuelle_patronal, 0)
    + coalesce(b.cimr_salarie, 0) + coalesce(b.cimr_patronal, 0);

  if p_target_status = 'validé' and not exists (
    select 1 from public.ecritures_comptables where source_id = b.id and source_type = 'salary_accrual'
  ) then
    insert into public.ecritures_comptables
      (company_id,dossier_id,numero_piece,date_ecriture,journal,compte,compte_label,debit,credit,libelle,source_type,source_id,is_validated)
    values
      (b.company_id,b.dossier_id,'PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'OD','6171','Rémunérations du personnel',b.salaire_brut,0,'Paie '||b.period_label,'salary_accrual',b.id,true),
      (b.company_id,b.dossier_id,'PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'OD','6174','Charges sociales',v_employer_charges,0,'Charges sociales '||b.period_label,'salary_accrual',b.id,true),
      (b.company_id,b.dossier_id,'PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'OD','4432','Rémunérations dues',0,b.salaire_net_payer,'Net à payer '||b.period_label,'salary_accrual',b.id,true),
      (b.company_id,b.dossier_id,'PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'OD','4441','CNSS et AMO à payer',0,v_social_payable,'Cotisations sociales '||b.period_label,'salary_accrual',b.id,true),
      (b.company_id,b.dossier_id,'PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'OD','44525','IR retenu à la source',0,b.ir_net,'IR salaire '||b.period_label,'salary_accrual',b.id,true),
      (b.company_id,b.dossier_id,'PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'OD','4448','Mutuelle et retraite à payer',0,v_benefit_payable,'Mutuelle/CIMR '||b.period_label,'salary_accrual',b.id,true);
  elsif p_target_status = 'payé' and not exists (
    select 1 from public.ecritures_comptables where source_id = b.id and source_type = 'salary_payment'
  ) then
    insert into public.ecritures_comptables
      (company_id,dossier_id,numero_piece,date_ecriture,journal,compte,compte_label,debit,credit,libelle,source_type,source_id,is_validated)
    values
      (b.company_id,b.dossier_id,'REG-PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'BQ','4432','Rémunérations dues',b.salaire_net_payer,0,'Règlement paie '||b.period_label,'salary_payment',b.id,true),
      (b.company_id,b.dossier_id,'REG-PAIE-'||b.annee||'-'||lpad(b.mois::text,2,'0'),v_date,'BQ','5141','Banques',0,b.salaire_net_payer,'Règlement paie '||b.period_label,'salary_payment',b.id,true);
  end if;

  update public.bulletins_paie
  set statut = p_target_status,
      paid_at = case when p_target_status = 'payé' then now() else paid_at end,
      date_paiement = case when p_target_status = 'payé' then v_date else date_paiement end
  where id = b.id returning * into b;
  return b;
end;
$$;

revoke all on function public.transition_payroll_bulletin(uuid,text,date) from public;
grant execute on function public.transition_payroll_bulletin(uuid,text,date) to authenticated;

drop policy if exists "Users manage own cnss declarations" on public.cnss_declarations;
create policy "Members manage scoped cnss declarations"
on public.cnss_declarations for all to authenticated
using (
  (company_id in (select c.id from public.companies c where public.member_has_permission('bulletin_paie','read',c.user_id)))
  or (dossier_id in (select d.id from public.dossiers d where public.member_has_permission('bulletin_paie','read',d.fiduciaire_user_id,d.id)))
)
with check (
  (company_id in (select c.id from public.companies c where public.member_has_permission('bulletin_paie','validate',c.user_id)))
  or (dossier_id in (select d.id from public.dossiers d where public.member_has_permission('bulletin_paie','validate',d.fiduciaire_user_id,d.id)))
);

drop policy if exists "Payroll users read leave balances" on public.employee_leave_balance;
drop policy if exists "Payroll users manage leave balances" on public.employee_leave_balance;
create policy "Payroll users read leave balances" on public.employee_leave_balance for select to authenticated
using (employee_id in (select e.id from public.employees e where public.member_has_permission('bulletin_paie','read',e.user_id,e.dossier_id)));
create policy "Payroll users manage leave balances" on public.employee_leave_balance for all to authenticated
using (employee_id in (select e.id from public.employees e where public.member_has_permission('bulletin_paie','validate',e.user_id,e.dossier_id)))
with check (employee_id in (select e.id from public.employees e where public.member_has_permission('bulletin_paie','validate',e.user_id,e.dossier_id)));

drop policy if exists "Payroll users read leave types" on public.leave_types;
create policy "Payroll users read leave types" on public.leave_types for select to authenticated
using (
  (company_id in (select c.id from public.companies c where public.member_has_permission('bulletin_paie','read',c.user_id)))
  or (dossier_id in (select d.id from public.dossiers d where public.member_has_permission('bulletin_paie','read',d.fiduciaire_user_id,d.id)))
);

alter table public.bulletins_paie
  drop constraint if exists bulletins_paie_period_check,
  add constraint bulletins_paie_period_check check (mois between 1 and 12 and annee between 1900 and 9999) not valid;

alter table public.bulletins_paie validate constraint bulletins_paie_period_check;

notify pgrst, 'reload schema';
commit;
