-- Make purchase documents and expense-note evidence mutually exclusive.
-- Historical rows are assigned once using the strongest provenance stored on
-- the row. Old bank-statement rows are quarantined rather than being
-- mislabeled or deleted.
UPDATE public.receipts
SET document_area = 'unclassified'
WHERE document_area = 'legacy'
  AND COALESCE(ocr_data->>'document_type', '') = 'bank_statement';

UPDATE public.receipts
SET document_area = CASE
  WHEN LOWER(COALESCE(ocr_data->>'is_supplier_invoice', 'true')) = 'false'
    THEN 'supporting_document'
  ELSE 'purchase'
END
WHERE document_area = 'legacy';

ALTER TABLE public.receipts
  DROP CONSTRAINT IF EXISTS receipts_document_area_check;

ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_document_area_check
  CHECK (document_area IN ('purchase', 'supporting_document', 'unclassified'));

CREATE OR REPLACE FUNCTION public.prevent_unclassified_receipt_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source_type = 'purchase' AND EXISTS (
    SELECT 1 FROM public.receipts receipt
    WHERE receipt.id = NEW.source_id
      AND receipt.document_area = 'unclassified'
  ) THEN
    RAISE EXCEPTION 'unclassified_document_cannot_be_booked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unclassified_receipt_booking
  ON public.accounting_booking_batches;
CREATE TRIGGER prevent_unclassified_receipt_booking
BEFORE INSERT ON public.accounting_booking_batches
FOR EACH ROW EXECUTE FUNCTION public.prevent_unclassified_receipt_booking();

INSERT INTO public.app_schema_version(singleton, version, applied_at)
VALUES (true, 114, now())
ON CONFLICT (singleton) DO UPDATE
SET version = excluded.version, applied_at = excluded.applied_at;

NOTIFY pgrst, 'reload schema';
