-- Company documents table (Archive page)
create table if not exists public.company_documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  document_category text,
  storage_path     text,
  file_name        text,
  mime_type        text,
  expiration_date  date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.company_documents enable row level security;

create policy "Users manage own company documents"
  on public.company_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_company_documents_user_id on public.company_documents(user_id, created_at desc);

-- Storage bucket for company documents
-- Run in Supabase dashboard or uncomment for CLI:
-- insert into storage.buckets (id, name, public)
-- values ('company-documents', 'company-documents', false)
-- on conflict do nothing;

-- Storage RLS
-- create policy "Auth users manage company docs"
--   on storage.objects for all
--   using (bucket_id = 'company-documents' and auth.uid()::text = (storage.foldername(name))[1])
--   with check (bucket_id = 'company-documents' and auth.uid()::text = (storage.foldername(name))[1]);
