-- Repair databases where migration 027 is recorded as applied but the
-- expanded bulletin columns were not created. The operation is idempotent.
begin;

alter table public.bulletins_paie
  add column if not exists date_paiement date,
  add column if not exists mode_paiement text,
  add column if not exists salaire_base numeric default 0,
  add column if not exists heures_theoriques numeric default 191.33,
  add column if not exists heures_travaillees numeric default 191.33,
  add column if not exists taux_horaire numeric default 0,
  add column if not exists heures_sup_25 numeric default 0,
  add column if not exists montant_sup_25 numeric default 0,
  add column if not exists heures_sup_50 numeric default 0,
  add column if not exists montant_sup_50 numeric default 0,
  add column if not exists heures_sup_100 numeric default 0,
  add column if not exists montant_sup_100 numeric default 0,
  add column if not exists jours_absence numeric default 0,
  add column if not exists montant_absence_deduit numeric default 0,
  add column if not exists jours_conge_pris numeric default 0,
  add column if not exists total_primes numeric default 0,
  add column if not exists total_indemnites numeric default 0,
  add column if not exists base_cnss numeric default 0,
  add column if not exists plafond_cnss numeric default 6000,
  add column if not exists net_imposable numeric default 0,
  add column if not exists deduction_familiale numeric default 0,
  add column if not exists net_a_payer numeric default 0,
  add column if not exists cout_employeur numeric default 0,
  add column if not exists notes text;

notify pgrst, 'reload schema';
commit;
