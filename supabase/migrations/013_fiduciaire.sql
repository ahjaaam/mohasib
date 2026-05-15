  -- Fiduciaire module migration

  -- Add user_type to companies
  ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'entrepreneur'
    CHECK (user_type IN ('entrepreneur', 'fiduciaire'));

  -- Cabinet settings (one per fiduciaire user)
  CREATE TABLE IF NOT EXISTS cabinets (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nom_cabinet      TEXT,
    ice              TEXT,
    rc               TEXT,
    if_fiscal        TEXT,
    adresse          TEXT,
    ville            TEXT,
    telephone        TEXT,
    email            TEXT,
    logo_url         TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE cabinets ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "user owns cabinet" ON cabinets;
  CREATE POLICY "user owns cabinet" ON cabinets FOR ALL USING (user_id = auth.uid());

  -- Dossiers (client companies managed by fiduciaire)
  CREATE TABLE IF NOT EXISTS dossiers (
    id                              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fiduciaire_user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raison_sociale                  TEXT NOT NULL,
    forme_juridique                 TEXT DEFAULT 'SARL',
    ice                             TEXT,
    if_fiscal                       TEXT,
    rc                              TEXT,
    cnss                            TEXT,
    regime_tva                      TEXT DEFAULT 'mensuel',
    taux_tva_defaut                 NUMERIC(5,2) DEFAULT 20,
    date_debut_exercice             DATE DEFAULT CURRENT_DATE,
    capital_social                  NUMERIC(15,2) DEFAULT 0,
    contact_nom                     TEXT,
    contact_email                   TEXT,
    contact_phone                   TEXT,
    solde_banque_initial            NUMERIC(15,2) DEFAULT 0,
    solde_caisse_initial            NUMERIC(15,2) DEFAULT 0,
    creances_clients_initiales      NUMERIC(15,2) DEFAULT 0,
    dettes_fournisseurs_initiales   NUMERIC(15,2) DEFAULT 0,
    statut                          TEXT DEFAULT 'actif',
    color                           TEXT DEFAULT '#C8924A',
    derniere_ecriture               TIMESTAMPTZ,
    notes                           TEXT,
    created_at                      TIMESTAMPTZ DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "fiduciaire owns dossiers" ON dossiers;
  CREATE POLICY "fiduciaire owns dossiers" ON dossiers FOR ALL USING (fiduciaire_user_id = auth.uid());

  -- Journal entries (double-entry bookkeeping)
  CREATE TABLE IF NOT EXISTS dossier_ecritures (
    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dossier_id           UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    fiduciaire_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    periode              TEXT NOT NULL,          -- 'YYYY-MM'
    journal              TEXT NOT NULL DEFAULT 'OD', -- VT, AC, BQ, CA, OD
    date                 DATE NOT NULL DEFAULT CURRENT_DATE,
    numero_piece         TEXT,
    compte_cgnc          TEXT,
    libelle              TEXT,
    debit                NUMERIC(15,2) DEFAULT 0,
    credit               NUMERIC(15,2) DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE dossier_ecritures ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "fiduciaire owns ecritures" ON dossier_ecritures;
  CREATE POLICY "fiduciaire owns ecritures" ON dossier_ecritures FOR ALL USING (fiduciaire_user_id = auth.uid());
  CREATE INDEX IF NOT EXISTS idx_dossier_ecritures_dossier_periode ON dossier_ecritures(dossier_id, periode);

  -- TVA declarations per dossier
  CREATE TABLE IF NOT EXISTS dossier_tva (
    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dossier_id           UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    fiduciaire_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    periode              TEXT NOT NULL,
    tva_collectee        NUMERIC(15,2) DEFAULT 0,
    tva_deductible       NUMERIC(15,2) DEFAULT 0,
    net_du               NUMERIC(15,2) DEFAULT 0,
    statut               TEXT DEFAULT 'a_deposer',
    date_depot           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dossier_id, periode)
  );
  ALTER TABLE dossier_tva ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "fiduciaire owns tva" ON dossier_tva;
  CREATE POLICY "fiduciaire owns tva" ON dossier_tva FOR ALL USING (fiduciaire_user_id = auth.uid());
