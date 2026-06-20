-- Backfill inbox_email for existing dossiers that don't have one yet
UPDATE dossiers
SET inbox_email = 'factures-' || substring(id::text, 1, 6) || '@mohasibai.com'
WHERE inbox_email IS NULL;
