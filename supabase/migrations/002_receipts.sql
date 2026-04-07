-- ============================================================
-- Mohasib — Receipts / Inbox
-- Run this in the Supabase SQL Editor after 001_init.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- RECEIPTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  storage_path    TEXT,
  file_name       TEXT,
  mime_type       TEXT,
  -- status: pending | matched | ignored
  status          TEXT NOT NULL DEFAULT 'pending',
  ocr_data        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_user_id        ON public.receipts(user_id);
CREATE INDEX idx_receipts_status         ON public.receipts(status);
CREATE INDEX idx_receipts_transaction_id ON public.receipts(transaction_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_own_data" ON public.receipts
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link transactions back to receipts
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- STORAGE BUCKET (run manually in Supabase dashboard
-- or uncomment if using supabase CLI)
-- ─────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('receipts', 'receipts', false)
-- ON CONFLICT DO NOTHING;

-- Storage RLS policies for the 'receipts' bucket:
-- Allow authenticated users to upload to their own folder (user_id/*)
-- CREATE POLICY "receipts_upload" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]
--   );
-- CREATE POLICY "receipts_read" ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]
--   );
-- CREATE POLICY "receipts_delete" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]
--   );
