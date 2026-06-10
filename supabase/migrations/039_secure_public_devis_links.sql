-- Public devis links must carry an unguessable response token before service-role
-- routes expose or mutate a document.
alter table public.invoices
  add column if not exists devis_response_token uuid default gen_random_uuid();

update public.invoices
set devis_response_token = gen_random_uuid()
where devis_response_token is null;

create unique index if not exists idx_invoices_devis_response_token
  on public.invoices(devis_response_token)
  where devis_response_token is not null;
