-- Extend tva_declarations with full SIMPL-TVA fields
alter table tva_declarations
  add column if not exists periode_type     text    default 'mensuel',
  add column if not exists mois             integer,
  add column if not exists annee            integer,
  add column if not exists trimestre        integer,

  -- Section A
  add column if not exists ca_total         numeric default 0,
  add column if not exists ca_exporte       numeric default 0,
  add column if not exists ca_exonere       numeric default 0,
  add column if not exists ca_hors_champ    numeric default 0,
  add column if not exists ca_suspension    numeric default 0,

  -- Section B: CA imposable par taux
  add column if not exists ca_imposable_7   numeric default 0,
  add column if not exists ca_imposable_10  numeric default 0,
  add column if not exists ca_imposable_14  numeric default 0,
  add column if not exists ca_imposable_20  numeric default 0,

  -- Section D: TVA exigible par taux
  add column if not exists tva_7            numeric default 0,
  add column if not exists tva_10           numeric default 0,
  add column if not exists tva_14           numeric default 0,
  add column if not exists tva_20           numeric default 0,
  add column if not exists tva_collectee_total numeric default 0,
  add column if not exists od_tva           numeric default 0,
  add column if not exists od_tva_note      text,

  -- Section E: Déductions
  add column if not exists deductions_charges       numeric default 0,
  add column if not exists deductions_immobilisations numeric default 0,
  add column if not exists deductions_total         numeric default 0,
  add column if not exists credit_reporte           numeric default 0,

  -- Droits de timbre
  add column if not exists nb_factures      integer default 0,
  add column if not exists droits_timbre    numeric default 0,

  -- Section F: Résultat
  add column if not exists tva_nette_due    numeric default 0,
  add column if not exists credit_tva       numeric default 0,

  -- Annual
  add column if not exists ca_exercice_annuel        numeric default 0,
  add column if not exists deductions_exercice_annuel numeric default 0,

  -- Status
  add column if not exists statut           text    default 'brouillon',
  add column if not exists deposee_at       timestamptz,
  add column if not exists simpl_reference  text;

-- Relevé des déductions
create table if not exists tva_releve_deductions (
  id                uuid primary key default gen_random_uuid(),
  declaration_id    uuid references tva_declarations(id) on delete cascade,
  company_id        uuid references companies(id) on delete cascade,
  dossier_id        uuid references dossiers(id) on delete set null,
  date_facture      date,
  numero_facture    text,
  fournisseur_nom   text,
  fournisseur_if    text,
  fournisseur_ice   text,
  designation       text,
  montant_ht        numeric default 0,
  taux_tva          numeric default 20,
  montant_tva       numeric default 0,
  montant_ttc       numeric default 0,
  mode_paiement     text,
  date_paiement     date,
  prorata           numeric default 100,
  tva_deductible    numeric default 0,
  type_deduction    text default 'charge',
  created_at        timestamptz default now()
);

alter table tva_releve_deductions enable row level security;
create policy if not exists "Users see own releve deductions"
  on tva_releve_deductions for all
  using (
    company_id in (select id from companies where user_id = auth.uid())
  );
