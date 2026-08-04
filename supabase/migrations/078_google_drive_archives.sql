-- Google Drive storage and multiple named archives.
-- Kept after the payment-allocation schema so it can be deployed independently.
-- OAuth tokens are only accessed through server-side routes using the service role.

create table if not exists public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_account_id text not null,
  email text,
  token_encrypted text not null,
  root_folder_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.google_drive_connections enable row level security;

create table if not exists public.document_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  drive_connection_id uuid not null references public.google_drive_connections(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  drive_folder_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_archives enable row level security;

create unique index if not exists idx_document_archives_scope_name
  on public.document_archives (
    user_id,
    coalesce(dossier_id::text, ''),
    lower(name)
  );

create index if not exists idx_document_archives_scope
  on public.document_archives(user_id, dossier_id, created_at);

alter table public.company_documents
  add column if not exists archive_id uuid references public.document_archives(id) on delete set null,
  add column if not exists storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'google_drive')),
  add column if not exists external_file_id text,
  add column if not exists external_web_url text;

create index if not exists idx_company_documents_archive_id
  on public.company_documents(archive_id, created_at desc);

notify pgrst, 'reload schema';
