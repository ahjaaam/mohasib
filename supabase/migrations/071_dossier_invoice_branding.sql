-- Dossier-scoped invoice branding + catalog — lets a dossier's client_portal
-- member customize their OWN invoice appearance (logo, bank details, footer,
-- accent color) instead of silently inheriting the cabinet's own company
-- branding, and manage their own line-item catalog scoped to just their dossier.

ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS logo_url                 TEXT,
  ADD COLUMN IF NOT EXISTS address                  TEXT,
  ADD COLUMN IF NOT EXISTS city                      TEXT,
  ADD COLUMN IF NOT EXISTS postal_code               TEXT,
  ADD COLUMN IF NOT EXISTS bank_name                 TEXT,
  ADD COLUMN IF NOT EXISTS rib                       TEXT,
  ADD COLUMN IF NOT EXISTS invoice_prefix            TEXT DEFAULT 'F-',
  ADD COLUMN IF NOT EXISTS invoice_payment_delay     TEXT DEFAULT '30 jours',
  ADD COLUMN IF NOT EXISTS invoice_mentions_legales  TEXT,
  ADD COLUMN IF NOT EXISTS invoice_color             TEXT DEFAULT '#C8924A';

ALTER TABLE invoice_items_catalog
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES public.dossiers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoice_items_catalog_dossier
  ON public.invoice_items_catalog(dossier_id) WHERE dossier_id IS NOT NULL;

-- Let a dossier's client_portal member manage their own dossier-scoped catalog
-- rows. The cabinet-wide catalog (dossier_id null) stays accountant-only —
-- dossier_id must be non-null AND permission-matched, closing the loophole
-- where member_has_permission(..., null) bypasses dossier scoping entirely.
DROP POLICY IF EXISTS "Owners insert invoice item catalog" ON public.invoice_items_catalog;
CREATE POLICY "Owners insert invoice item catalog"
  ON public.invoice_items_catalog FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (dossier_id IS NOT NULL AND public.member_has_permission('invoice', 'create', user_id, dossier_id))
  );

DROP POLICY IF EXISTS "Owners update invoice item catalog" ON public.invoice_items_catalog;
CREATE POLICY "Owners update invoice item catalog"
  ON public.invoice_items_catalog FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (dossier_id IS NOT NULL AND public.member_has_permission('invoice', 'update', user_id, dossier_id))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (dossier_id IS NOT NULL AND public.member_has_permission('invoice', 'update', user_id, dossier_id))
  );

DROP POLICY IF EXISTS "Owners delete invoice item catalog" ON public.invoice_items_catalog;
CREATE POLICY "Owners delete invoice item catalog"
  ON public.invoice_items_catalog FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (dossier_id IS NOT NULL AND public.member_has_permission('invoice', 'delete', user_id, dossier_id))
  );
