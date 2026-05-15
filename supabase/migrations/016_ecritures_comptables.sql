-- Double-entry journal entries (unified for entrepreneurs + fiduciaire)

CREATE TABLE IF NOT EXISTS public.ecritures_comptables (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  dossier_id      UUID REFERENCES public.dossiers(id) ON DELETE CASCADE,
  -- Entry identification
  numero_piece    TEXT,
  date_ecriture   DATE NOT NULL,
  date_valeur     DATE,
  journal         TEXT NOT NULL,
  -- VT=Ventes, AC=Achats, BQ=Banque, CA=Caisse, OD=Opérations Diverses
  -- Account
  compte          TEXT NOT NULL,
  compte_label    TEXT,
  -- Amounts
  debit           NUMERIC(15,2) DEFAULT 0,
  credit          NUMERIC(15,2) DEFAULT 0,
  libelle         TEXT,
  -- Source
  source_type     TEXT,
  -- 'invoice' | 'purchase' | 'bank' | 'manual' | 'salary'
  source_id       UUID,
  -- Lettrage
  lettre          TEXT,
  lettre_date     DATE,
  is_lettered     BOOLEAN DEFAULT FALSE,
  -- Status
  is_validated    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_company   ON public.ecritures_comptables(company_id);
CREATE INDEX IF NOT EXISTS idx_ec_dossier   ON public.ecritures_comptables(dossier_id);
CREATE INDEX IF NOT EXISTS idx_ec_compte    ON public.ecritures_comptables(compte);
CREATE INDEX IF NOT EXISTS idx_ec_source    ON public.ecritures_comptables(source_id);
CREATE INDEX IF NOT EXISTS idx_ec_lettre    ON public.ecritures_comptables(lettre);
CREATE INDEX IF NOT EXISTS idx_ec_date      ON public.ecritures_comptables(date_ecriture);

ALTER TABLE public.ecritures_comptables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecritures_owner" ON public.ecritures_comptables;
CREATE POLICY "ecritures_owner" ON public.ecritures_comptables
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR
    dossier_id IN (
      SELECT id FROM public.dossiers WHERE fiduciaire_user_id = auth.uid()
    )
  );
