-- Private, versioned source corpus for Mohasib's Moroccan accounting research assistant.

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  document_type text not null check (document_type in (
    'law', 'tax_code', 'finance_law', 'regulation', 'administrative_guidance',
    'accounting_standard', 'professional_guidance', 'academic', 'other'
  )),
  publisher text not null,
  authority_level smallint not null default 3 check (authority_level between 1 and 5),
  language text not null default 'fr' check (language in ('fr', 'ar', 'en', 'multi')),
  canonical_url text not null,
  document_reference text,
  published_on date,
  effective_from date,
  effective_to date,
  publication_status text not null default 'active' check (publication_status in ('draft', 'active', 'superseded', 'repealed')),
  ingestion_status text not null default 'catalogued' check (ingestion_status in ('catalogued', 'processing', 'ready', 'failed')),
  storage_path text,
  original_filename text,
  content_sha256 text,
  page_count integer,
  chunk_count integer not null default 0,
  last_verified_at timestamptz,
  ingest_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_sources_effective_dates check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint knowledge_sources_https_url check (canonical_url ~ '^https://')
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  chunk_index integer not null,
  locator text not null,
  content text not null,
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index),
  check (length(content) between 1 and 12000)
);

create index if not exists knowledge_chunks_search_idx on public.knowledge_chunks using gin(search_vector);
create index if not exists knowledge_chunks_source_idx on public.knowledge_chunks(source_id, chunk_index);
create index if not exists knowledge_sources_search_scope_idx
  on public.knowledge_sources(publication_status, ingestion_status, effective_from, effective_to);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Source files are public references but the curated corpus and ingestion state are server-managed.
revoke all on public.knowledge_sources from anon, authenticated;
revoke all on public.knowledge_chunks from anon, authenticated;
grant all on public.knowledge_sources to service_role;
grant all on public.knowledge_chunks to service_role;

create or replace function public.search_knowledge_sources(
  query_text text,
  as_of_date date default current_date,
  result_limit integer default 6
)
returns table (
  chunk_id uuid,
  source_id uuid,
  source_key text,
  source_title text,
  document_type text,
  publisher text,
  authority_level smallint,
  language text,
  canonical_url text,
  document_reference text,
  published_on date,
  effective_from date,
  effective_to date,
  locator text,
  content text,
  relevance real
)
language sql
stable
security definer
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('simple'::regconfig, left(coalesce(query_text, ''), 1200)) as tsq
  ), ranked as (
    select
      chunk.id as chunk_id,
      source.id as source_id,
      source.source_key,
      source.title as source_title,
      source.document_type,
      source.publisher,
      source.authority_level,
      source.language,
      source.canonical_url,
      source.document_reference,
      source.published_on,
      source.effective_from,
      source.effective_to,
      chunk.locator,
      chunk.content,
      ts_rank_cd(chunk.search_vector, query.tsq) as relevance
    from public.knowledge_chunks chunk
    join public.knowledge_sources source on source.id = chunk.source_id
    cross join query
    where query.tsq <> ''::tsquery
      and chunk.search_vector @@ query.tsq
      and source.ingestion_status = 'ready'
      and source.publication_status = 'active'
      and (source.effective_from is null or source.effective_from <= coalesce(as_of_date, current_date))
      and (source.effective_to is null or source.effective_to >= coalesce(as_of_date, current_date))
  )
  select * from ranked
  order by relevance desc, authority_level desc, published_on desc nulls last
  limit greatest(1, least(coalesce(result_limit, 6), 10));
$$;

revoke all on function public.search_knowledge_sources(text, date, integer) from public, anon, authenticated;
grant execute on function public.search_knowledge_sources(text, date, integer) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('mohasib-knowledge', 'mohasib-knowledge', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

insert into public.knowledge_sources
  (source_key, title, document_type, publisher, authority_level, language, canonical_url, document_reference, published_on, effective_from)
values
  ('cgi-2026', 'Code Général des Impôts 2026', 'tax_code', 'Ministère de l’Économie et des Finances · DGI', 5, 'fr', 'https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf', 'CGI 2026', '2026-01-05', '2026-01-01'),
  ('cgi-2026-ar', 'المدونة العامة للضرائب 2026', 'tax_code', 'وزارة الاقتصاد والمالية · المديرية العامة للضرائب', 5, 'ar', 'https://www.finances.gov.ma/ar/Pages/publications.aspx', 'CGI 2026 · édition arabe', '2026-01-05', '2026-01-01'),
  ('law-9-88-cnc', 'Loi n° 9-88 relative aux obligations comptables des commerçants', 'law', 'Secrétariat Général du Gouvernement · Bulletin Officiel', 5, 'fr', 'https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx', 'Dahir n° 1-92-138 du 25 décembre 1992', null, null),
  ('cgnc-cnc', 'Code Général de la Normalisation Comptable (CGNC), tomes I et II', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Nos-metiers/Pages/cnc-normes.aspx', 'CGNC · tomes I et II', null, null),
  ('cnc-avis-comptables', 'Avis adoptés par le Conseil National de la Comptabilité', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Nos-metiers/Pages/cnc-normes.aspx', 'Avis CNC, dont avis n° 24 sur la comptabilité électronique', null, null),
  ('lf-2026', 'Loi de finances 2026 et textes d’application', 'finance_law', 'Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Pages/publications.aspx', 'Loi de finances pour l’année budgétaire 2026', null, '2026-01-01'),
  ('dgi-guidance', 'Notes circulaires et guides de la Direction Générale des Impôts', 'administrative_guidance', 'Direction Générale des Impôts · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Pages/publications.aspx', 'À compléter avec les éditions correspondant aux lois de finances', null, null),
  ('code-travail', 'Code du travail marocain et textes d’application', 'law', 'Secrétariat Général du Gouvernement · Bulletin Officiel', 5, 'fr', 'https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx', 'Loi n° 65-99 formant Code du travail', null, null),
  ('code-societes-5-96', 'Loi n° 5-96 sur les SARL et autres sociétés', 'law', 'Secrétariat Général du Gouvernement · Bulletin Officiel', 5, 'fr', 'https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx', 'Loi n° 5-96, telle que modifiée', null, null),
  ('cnss-guides', 'Guides employeurs et règles de cotisations sociales', 'administrative_guidance', 'Caisse Nationale de Sécurité Sociale', 5, 'fr', 'https://www.cnss.ma/', 'À vérifier par exercice et catégorie de salarié', null, null),
  ('code-douanes-adii', 'Code des douanes et impôts indirects', 'law', 'Administration des Douanes et Impôts Indirects · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Ministere/Pages/adii.aspx', 'Code des douanes et impôts indirects', null, null),
  ('igoc-2026', 'Instruction Générale des Opérations de Change 2026', 'regulation', 'Office des Changes', 5, 'fr', 'https://www.oc.gov.ma/sites/default/files/reglementation/pdf/2026-01/IGOC%202026.pdf', 'IGOC 2026', '2025-12-31', '2026-01-01'),
  ('law-09-08-cndp', 'Loi n° 09-08 relative à la protection des données à caractère personnel', 'law', 'Commission Nationale de contrôle de la protection des Données à caractère Personnel', 5, 'fr', 'https://www.cndp.ma/textes-et-lois/', 'Loi n° 09-08 et décret d’application', null, null),
  ('bulletin-officiel-sgg', 'Bulletin Officiel du Royaume du Maroc · recherche des textes', 'other', 'Secrétariat Général du Gouvernement · Imprimerie Officielle', 5, 'multi', 'https://www.sgg.gov.ma/accueil.aspx', 'Lois, dahirs, décrets, arrêtés et textes consolidés', null, null)
on conflict (source_key) do nothing;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 115, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
