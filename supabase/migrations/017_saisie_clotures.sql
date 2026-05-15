-- Accounting period locks for fiduciaire saisie comptable

CREATE TABLE IF NOT EXISTS public.dossier_clotures (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id           UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  fiduciaire_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periode              TEXT NOT NULL,   -- 'YYYY-MM'
  closed_at            TIMESTAMPTZ DEFAULT NOW(),
  closed_by_name       TEXT,
  UNIQUE(dossier_id, periode)
);

ALTER TABLE public.dossier_clotures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiduciaire_owns_clotures" ON public.dossier_clotures;
CREATE POLICY "fiduciaire_owns_clotures" ON public.dossier_clotures
  FOR ALL USING (fiduciaire_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dossier_clotures_period
  ON public.dossier_clotures(dossier_id, periode);
