-- Signup qualification answers are informational only. Once an administrator
-- activates an account, its custom plan starts with every product module
-- enabled. Per-account overrides still take precedence and can restrict any
-- feature or limit explicitly.
update public.plan_limits
set
  ocr_limit = -1,
  storage_gb = -1,
  dossiers_limit = -1,
  users_limit = 5,
  employee_limit = -1,
  has_bank_import = true,
  has_saisie = true,
  has_paie = true,
  has_export_fiduciaire = true,
  has_avoirs = true,
  has_bilan = true,
  has_tva_edi = true,
  has_inbox_global = true,
  has_mass_declarations = true,
  has_whatsapp_agent = true
where plan = 'custom';

notify pgrst, 'reload schema';
