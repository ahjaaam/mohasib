-- Optional payroll fields on employees

alter table public.employees
  add column if not exists matricule            text,
  add column if not exists has_mutuelle         boolean default false,
  add column if not exists mutuelle_taux_salarie  numeric default 2.59,
  add column if not exists mutuelle_taux_patronal numeric default 2.59,
  add column if not exists has_cimr             boolean default false,
  add column if not exists cimr_taux_salarie    numeric default 3.00,
  add column if not exists cimr_taux_patronal   numeric default 3.90;
