-- Fix missing columns in bulletins_paie

alter table public.bulletins_paie
  add column if not exists deduction_charge_famille numeric default 0,
  add column if not exists ir_brut numeric not null default 0,
  add column if not exists frais_pro numeric not null default 0;
