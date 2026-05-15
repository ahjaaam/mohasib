-- ── Avoirs (Credit Notes) ─────────────────────────────────────────────────────

-- invoice_type discriminator: facture | avoir_client | proforma
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'facture';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS avoir_reason text;

-- Avoirs fournisseurs (credit notes received from suppliers)
CREATE TABLE IF NOT EXISTS avoirs_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id uuid REFERENCES dossiers(id) ON DELETE SET NULL,
  numero_interne text NOT NULL,
  ref_fournisseur text,
  fournisseur text NOT NULL,
  date date NOT NULL,
  montant_ht numeric(12,2) NOT NULL DEFAULT 0,
  tva_amount numeric(12,2) NOT NULL DEFAULT 0,
  tva_rate numeric(5,2) NOT NULL DEFAULT 20,
  total numeric(12,2) NOT NULL DEFAULT 0,
  motif text,
  compte_comptable text DEFAULT '4411',
  statut text NOT NULL DEFAULT 'recu',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE avoirs_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their avoirs fournisseurs"
  ON avoirs_fournisseurs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
