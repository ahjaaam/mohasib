-- Repair installations with the employee form but without the employee columns
-- from migration 027. Keep this scoped to employees; do not change RLS policies.
begin;

alter table public.employees
  add column if not exists cnss_number text,
  add column if not exists date_fin_contrat date,
  add column if not exists salaire_base numeric not null default 0,
  add column if not exists mode_paiement text default 'virement',
  add column if not exists heures_travail_semaine numeric default 44,
  add column if not exists jours_travail_semaine numeric default 6,
  add column if not exists is_active boolean default true,
  add column if not exists notes text;

update public.employees
set cnss_number = numero_cnss
where cnss_number is null and numero_cnss is not null;

update public.employees
set salaire_base = salaire_brut
where salaire_base = 0 and salaire_brut is not null;

update public.employees
set is_active = (statut = 'actif')
where statut is not null and is_active is distinct from (statut = 'actif');

notify pgrst, 'reload schema';
commit;
