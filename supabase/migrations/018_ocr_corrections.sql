CREATE TABLE IF NOT EXISTS public.ocr_corrections (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  dossier_id           UUID REFERENCES public.dossiers(id) ON DELETE CASCADE,
  receipt_id           UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
  original_extraction  JSONB,
  corrected_values     JSONB,
  document_type        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ocr_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_corrections_owner" ON public.ocr_corrections;
CREATE POLICY "ocr_corrections_owner" ON public.ocr_corrections
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR dossier_id IN (SELECT id FROM public.dossiers WHERE fiduciaire_user_id = auth.uid())
  );
