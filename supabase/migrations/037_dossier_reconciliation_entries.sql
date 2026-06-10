-- Allow reconciliation lines to reference the dossier-specific accounting journal.
alter table public.rapprochement_lignes
  add column if not exists dossier_ecriture_id uuid references public.dossier_ecritures(id) on delete set null;

create index if not exists idx_rapprochement_lignes_dossier_ecriture
  on public.rapprochement_lignes(dossier_ecriture_id);
