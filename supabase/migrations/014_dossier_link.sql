-- Link clients, invoices, and transactions to fiduciaire dossiers

-- ── clients ────────────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp     TEXT,
  ADD COLUMN IF NOT EXISTS postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS country      TEXT DEFAULT 'Maroc',
  ADD COLUMN IF NOT EXISTS if_number    TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_dossier_id ON public.clients(dossier_id);

-- Allow fiduciaire to access clients that belong to their dossiers
DROP POLICY IF EXISTS "fiduciaire dossier clients" ON public.clients;
CREATE POLICY "fiduciaire dossier clients" ON public.clients
  FOR ALL USING (
    dossier_id IS NOT NULL AND
    dossier_id IN (SELECT id FROM dossiers WHERE fiduciaire_user_id = auth.uid())
  );

-- ── invoices ───────────────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoices_dossier_id ON public.invoices(dossier_id);

-- Replace global unique(user_id, invoice_number) with two partial indexes so
-- fiduciaire dossiers each have their own independent number sequence.
DROP INDEX IF EXISTS idx_invoices_number;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_user
  ON public.invoices(user_id, invoice_number)
  WHERE dossier_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_dossier
  ON public.invoices(dossier_id, invoice_number)
  WHERE dossier_id IS NOT NULL;

DROP POLICY IF EXISTS "fiduciaire dossier invoices" ON public.invoices;
CREATE POLICY "fiduciaire dossier invoices" ON public.invoices
  FOR ALL USING (
    dossier_id IS NOT NULL AND
    dossier_id IN (SELECT id FROM dossiers WHERE fiduciaire_user_id = auth.uid())
  );

-- ── receipts ──────────────────────────────────────────────────────────────────
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_receipts_dossier_id ON public.receipts(dossier_id);

DROP POLICY IF EXISTS "fiduciaire dossier receipts" ON public.receipts;
CREATE POLICY "fiduciaire dossier receipts" ON public.receipts
  FOR ALL USING (
    dossier_id IS NOT NULL AND
    dossier_id IN (SELECT id FROM dossiers WHERE fiduciaire_user_id = auth.uid())
  );

-- ── transactions ───────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_dossier_id ON public.transactions(dossier_id);

DROP POLICY IF EXISTS "fiduciaire dossier transactions" ON public.transactions;
CREATE POLICY "fiduciaire dossier transactions" ON public.transactions
  FOR ALL USING (
    dossier_id IS NOT NULL AND
    dossier_id IN (SELECT id FROM dossiers WHERE fiduciaire_user_id = auth.uid())
  );
