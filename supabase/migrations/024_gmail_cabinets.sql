-- Gmail / Outlook OAuth columns on cabinets (used by comptable-pro users)
ALTER TABLE cabinets
  ADD COLUMN IF NOT EXISTS gmail_token_encrypted   TEXT,
  ADD COLUMN IF NOT EXISTS gmail_email             TEXT,
  ADD COLUMN IF NOT EXISTS gmail_label_id          TEXT,
  ADD COLUMN IF NOT EXISTS gmail_connected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_last_sync         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_import_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outlook_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS outlook_email           TEXT,
  ADD COLUMN IF NOT EXISTS outlook_connected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outlook_last_sync       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outlook_import_count    INTEGER DEFAULT 0;
