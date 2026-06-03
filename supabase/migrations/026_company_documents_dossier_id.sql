-- Scope archive company documents to either the main account or a specific dossier.
alter table public.company_documents
  add column if not exists dossier_id uuid references public.dossiers(id) on delete cascade;

create index if not exists idx_company_documents_dossier_id
  on public.company_documents(dossier_id, created_at desc);

drop policy if exists "fiduciaire dossier company documents" on public.company_documents;
create policy "fiduciaire dossier company documents" on public.company_documents
  for all using (
    dossier_id is not null and
    dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  )
  with check (
    dossier_id is not null and
    dossier_id in (select id from public.dossiers where fiduciaire_user_id = auth.uid())
  );
