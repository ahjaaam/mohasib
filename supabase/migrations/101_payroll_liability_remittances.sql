begin;

alter table public.bulletins_paie
  add column if not exists social_paid_at date,
  add column if not exists ir_paid_at date;

create or replace function public.protect_finalized_payroll()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.statut in ('validé', 'payé') then
    raise exception 'finalized_payroll_is_immutable';
  end if;
  if tg_op = 'UPDATE' and old.statut = 'payé'
    and (to_jsonb(new) - array['social_paid_at','ir_paid_at'])
      is distinct from (to_jsonb(old) - array['social_paid_at','ir_paid_at']) then
    raise exception 'paid_payroll_is_immutable';
  end if;
  if tg_op = 'UPDATE' and old.statut = 'validé' and new.statut not in ('validé', 'payé') then
    raise exception 'validated_payroll_cannot_be_reopened';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.settle_payroll_period(
  p_mois integer,
  p_annee integer,
  p_company_id uuid default null,
  p_dossier_id uuid default null,
  p_kind text default 'social',
  p_payment_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bulletins_paie;
  v_count integer := 0;
  v_social numeric;
  v_benefits numeric;
  v_ir numeric;
  v_total numeric;
  v_cash_account text;
  v_cash_label text;
  v_journal text;
begin
  if p_mois not between 1 and 12 or p_annee not between 1900 and 9999 then
    raise exception 'invalid_payroll_period';
  end if;
  if p_kind not in ('social', 'ir') then raise exception 'invalid_remittance_kind'; end if;
  if (p_company_id is null) = (p_dossier_id is null) then raise exception 'invalid_payroll_scope'; end if;
  if p_company_id is not null and not exists (
    select 1 from public.companies c
    where c.id = p_company_id and public.member_has_permission('bulletin_paie','validate',c.user_id)
  ) then raise exception 'payroll_permission_denied'; end if;
  if p_dossier_id is not null and not exists (
    select 1 from public.dossiers d
    where d.id = p_dossier_id and public.member_has_permission('bulletin_paie','validate',d.fiduciaire_user_id,d.id)
  ) then raise exception 'payroll_permission_denied'; end if;

  for b in
    select * from public.bulletins_paie
    where mois = p_mois and annee = p_annee
      and statut in ('validé','payé')
      and ((p_company_id is not null and company_id = p_company_id)
        or (p_dossier_id is not null and dossier_id = p_dossier_id))
      and ((p_kind = 'social' and social_paid_at is null)
        or (p_kind = 'ir' and ir_paid_at is null))
    for update
  loop
    v_cash_account := case when lower(coalesce(b.mode_paiement, 'virement')) in ('espèces','especes','cash') then '5161' else '5141' end;
    v_cash_label := case when v_cash_account = '5161' then 'Caisse' else 'Banques' end;
    v_journal := case when v_cash_account = '5161' then 'CA' else 'BQ' end;
    v_social := coalesce(b.cnss_salarie,0) + coalesce(b.cnss_patronal,0)
      + coalesce(b.amo_salarie,0) + coalesce(b.amo_patronal,0) + coalesce(b.taxe_formation_pro,0);
    v_benefits := coalesce(b.mutuelle_salarie,0) + coalesce(b.mutuelle_patronal,0)
      + coalesce(b.cimr_salarie,0) + coalesce(b.cimr_patronal,0);
    v_ir := coalesce(b.ir_net,0);

    if p_kind = 'social' then
      v_total := v_social + v_benefits;
      if v_total > 0 and not exists (
        select 1 from public.ecritures_comptables where source_id = b.id and source_type = 'salary_social_payment'
      ) then
        if v_social > 0 then
          insert into public.ecritures_comptables
            (company_id,dossier_id,numero_piece,date_ecriture,journal,compte,compte_label,debit,credit,libelle,source_type,source_id,is_validated)
          values (b.company_id,b.dossier_id,'REG-SOC-'||b.annee||'-'||lpad(b.mois::text,2,'0'),p_payment_date,v_journal,'4441','CNSS et AMO à payer',v_social,0,'Règlement cotisations sociales '||b.period_label,'salary_social_payment',b.id,true);
        end if;
        if v_benefits > 0 then
          insert into public.ecritures_comptables
            (company_id,dossier_id,numero_piece,date_ecriture,journal,compte,compte_label,debit,credit,libelle,source_type,source_id,is_validated)
          values (b.company_id,b.dossier_id,'REG-SOC-'||b.annee||'-'||lpad(b.mois::text,2,'0'),p_payment_date,v_journal,'4448','Mutuelle et retraite à payer',v_benefits,0,'Règlement mutuelle/CIMR '||b.period_label,'salary_social_payment',b.id,true);
        end if;
        insert into public.ecritures_comptables
          (company_id,dossier_id,numero_piece,date_ecriture,journal,compte,compte_label,debit,credit,libelle,source_type,source_id,is_validated)
        values (b.company_id,b.dossier_id,'REG-SOC-'||b.annee||'-'||lpad(b.mois::text,2,'0'),p_payment_date,v_journal,v_cash_account,v_cash_label,0,v_total,'Règlement organismes sociaux '||b.period_label,'salary_social_payment',b.id,true);
      end if;
      update public.bulletins_paie set social_paid_at = p_payment_date where id = b.id;
    else
      if v_ir > 0 and not exists (
        select 1 from public.ecritures_comptables where source_id = b.id and source_type = 'salary_ir_payment'
      ) then
        insert into public.ecritures_comptables
          (company_id,dossier_id,numero_piece,date_ecriture,journal,compte,compte_label,debit,credit,libelle,source_type,source_id,is_validated)
        values
          (b.company_id,b.dossier_id,'REG-IR-'||b.annee||'-'||lpad(b.mois::text,2,'0'),p_payment_date,v_journal,'44525','IR retenu à la source',v_ir,0,'Règlement IR salaires '||b.period_label,'salary_ir_payment',b.id,true),
          (b.company_id,b.dossier_id,'REG-IR-'||b.annee||'-'||lpad(b.mois::text,2,'0'),p_payment_date,v_journal,v_cash_account,v_cash_label,0,v_ir,'Règlement IR salaires '||b.period_label,'salary_ir_payment',b.id,true);
      end if;
      update public.bulletins_paie set ir_paid_at = p_payment_date where id = b.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.settle_payroll_period(integer,integer,uuid,uuid,text,date) from public;
grant execute on function public.settle_payroll_period(integer,integer,uuid,uuid,text,date) to authenticated;

notify pgrst, 'reload schema';
commit;
