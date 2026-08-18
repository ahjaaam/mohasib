alter table public.invoices
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists import_source text;

create index if not exists idx_invoices_source_document_id
  on public.invoices(source_document_id)
  where source_document_id is not null;
