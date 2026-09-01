-- Keep supplier purchases and general supporting documents in distinct workspaces.
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS document_area TEXT;

-- Existing rows were historically visible in both document workspaces and do
-- not contain enough provenance to classify them safely. Keep them visible in
-- both places until a user explicitly reclassifies them; all new writes set an
-- explicit area.
UPDATE public.receipts
SET document_area = 'legacy'
WHERE document_area IS NULL;

ALTER TABLE public.receipts
  ALTER COLUMN document_area SET DEFAULT 'purchase',
  ALTER COLUMN document_area SET NOT NULL;

ALTER TABLE public.receipts
  DROP CONSTRAINT IF EXISTS receipts_document_area_check;

ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_document_area_check
  CHECK (document_area IN ('purchase', 'supporting_document', 'legacy'));

CREATE INDEX IF NOT EXISTS idx_receipts_document_area
  ON public.receipts(user_id, document_area, created_at DESC);
