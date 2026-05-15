ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES dossiers(id) ON DELETE SET NULL;

ALTER TABLE public.bulletins_paie
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES dossiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_dossier   ON public.employees(dossier_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_dossier   ON public.bulletins_paie(dossier_id);
