-- Gmail / Outlook OAuth columns on dossiers — lets a dossier's client_portal
-- member connect their own personal mailbox, scoped to just that dossier
-- (mirrors the same flat-column pattern already used on companies/012 and cabinets/024).
ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS gmail_token_encrypted   TEXT,
  ADD COLUMN IF NOT EXISTS gmail_email             TEXT,
  ADD COLUMN IF NOT EXISTS gmail_connected_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_last_sync          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_import_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outlook_token_encrypted  TEXT,
  ADD COLUMN IF NOT EXISTS outlook_email            TEXT,
  ADD COLUMN IF NOT EXISTS outlook_connected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outlook_last_sync        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outlook_import_count     INTEGER DEFAULT 0;
