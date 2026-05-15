ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS whatsapp_template TEXT,
  ADD COLUMN IF NOT EXISTS email_template    TEXT;
