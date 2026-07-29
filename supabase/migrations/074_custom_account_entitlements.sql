-- Direct, admin-managed account entitlements replace package selection.
-- Existing package rows remain for backward compatibility only.

-- Some older production projects created plan_limits before this feature
-- column existed. Repair that historical schema drift before inserting the
-- custom plan row.
alter table public.plan_limits
  add column if not exists has_whatsapp_agent boolean default false;

insert into public.plan_limits (
  plan,
  label,
  price_monthly,
  ocr_limit,
  storage_gb,
  dossiers_limit,
  users_limit,
  employee_limit,
  has_bank_import,
  has_saisie,
  has_paie,
  has_export_fiduciaire,
  has_avoirs,
  has_bilan,
  has_tva_edi,
  has_inbox_global,
  has_mass_declarations,
  has_whatsapp_agent
)
values (
  'custom',
  'Abonnement personnalisé',
  0,
  0,
  0,
  0,
  1,
  0,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false
)
on conflict (plan) do nothing;

notify pgrst, 'reload schema';
