-- Deduplication key for email-imported receipts (provider:messageId)
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS email_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS receipts_email_message_id_unique
  ON public.receipts (email_message_id)
  WHERE email_message_id IS NOT NULL;
