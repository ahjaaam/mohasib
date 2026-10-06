-- Curated first wave of Moroccan primary sources. Catalog entries remain
-- non-searchable until the official PDF is ingested into knowledge_chunks.
insert into public.knowledge_sources
  (source_key, title, document_type, publisher, authority_level, language,
   canonical_url, document_reference, published_on, effective_from, effective_to,
   publication_status, ingestion_status)
values
  ('cgi-2026', 'Code Général des Impôts 2026 · édition française', 'tax_code', 'Ministère de l’Économie et des Finances · DGI', 5, 'fr', 'https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf', 'CGI 2026 · intègre la loi de finances n° 50-25', '2026-01-05', '2026-01-01', null, 'active', 'catalogued'),
  ('cgi-2026-ar', 'المدونة العامة للضرائب 2026 · النسخة العربية', 'tax_code', 'وزارة الاقتصاد والمالية · المديرية العامة للضرائب', 5, 'ar', 'https://www.finances.gov.ma/ar/Pages/publications.aspx', 'المدونة العامة للضرائب 2026', '2026-01-05', '2026-01-01', null, 'active', 'catalogued'),
  ('lf-2026-text', 'Loi de finances 2026 · texte promulgué', 'finance_law', 'Ministère de l’Économie et des Finances · Bulletin Officiel', 5, 'fr', 'https://www.finances.gov.ma/fr/vous-orientez/Pages/plf2026.aspx', 'Loi n° 50-25 pour l’année budgétaire 2026 · BO n° 7465 bis', '2025-12-16', '2026-01-01', null, 'active', 'catalogued'),
  ('dgi-nc-737-lf2026', 'Note circulaire DGI n° 737 · Loi de finances 2026', 'administrative_guidance', 'Direction Générale des Impôts · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/lbc/Pages/publications0.aspx', 'Note circulaire n° 737 relative aux mesures fiscales de la loi n° 50-25', '2026-03-10', '2026-01-01', null, 'active', 'catalogued'),
  ('law-5-96-consol-2021', 'Sociétés · loi n° 5-96, consolidation au 19 août 2021', 'law', 'Ministère de la Justice · Direction de la législation et des études', 5, 'fr', 'https://adala.justice.gov.ma/api/uploads/2024/03/26/LA%20SOCIETE%20EN%20NOM%20COLLECTIF-1711463631100.pdf', 'Texte consolidé au 19 août 2021 · inclut la loi n° 19-20', '2021-08-19', null, null, 'active', 'catalogued'),
  ('code-commerce-consol-2019', 'Code de commerce · loi n° 15-95, consolidation au 19 décembre 2019', 'law', 'Ministère de la Justice · Direction de la législation et des études', 5, 'fr', 'https://adala.justice.gov.ma/api/uploads/2024/03/01/Code%20de%20commerce_compressed-1709282723074.pdf', 'Texte consolidé au 19 décembre 2019', '2019-12-19', null, null, 'active', 'catalogued'),
  ('law-44-03-accounting', 'Loi n° 44-03 · modification des obligations comptables', 'law', 'Ministère de l’Économie et des Finances · DEPP', 5, 'fr', 'https://www.finances.gov.ma/Publication/depp/2008/6924_loi44_03modifiantetcompletantlaloin_9_88relativeauxobligationscomptablesdescommercants.pdf', 'Loi n° 44-03 modifiant et complétant la loi n° 9-88 · BO n° 5404', '2006-03-16', null, null, 'active', 'catalogued'),
  ('law-9-88-cnc', 'Loi n° 9-88 · obligations comptables des commerçants', 'law', 'Secrétariat Général du Gouvernement · Bulletin Officiel', 5, 'fr', 'https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx', 'Dahir n° 1-92-138 du 25 décembre 1992 · lire avec la loi modificative n° 44-03', null, null, null, 'active', 'catalogued'),
  ('cgnc-cnc', 'Code Général de la Normalisation Comptable · tomes I et II', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Nos-metiers/Pages/cnc-normes.aspx', 'CGNC · référentiel comptable marocain', null, null, null, 'active', 'catalogued'),
  ('cnc-avis-1-2', 'Avis CNC n° 1 et n° 2 · application de la loi n° 9-88', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Nos-metiers/Pages/cnc-normes.aspx', 'Avis adoptés le 26 juillet 1993 · modalités d’application de la loi n° 9-88', '1993-07-26', null, null, 'active', 'catalogued'),
  ('cnc-avis-24', 'Avis CNC n° 24 · comptabilité normalisée informatisée', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Pages/detail-actualite.aspx?fiche=6558', 'Avis n° 24 relatif aux principes et critères de la comptabilité tenue sur traitements informatiques', '2023-06-14', null, null, 'active', 'catalogued'),
  ('cnc-avis-25', 'Avis CNC n° 25 · comptabilité des syndicats de copropriétaires', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Pages/detail-actualite.aspx?fiche=6558', 'Avis n° 25 relatif aux règles comptables applicables aux syndicats de copropriétaires', '2023-06-14', null, null, 'active', 'catalogued'),
  ('code-travail-65-99', 'Code du travail · loi n° 65-99 (texte initial)', 'law', 'Secrétariat Général du Gouvernement · Bulletin Officiel', 5, 'fr', 'https://www.sgg.gov.ma/BO/bo_fr/2004/BO_5210_Fr.pdf', 'BO n° 5210 · texte initial, à ne pas utiliser seul comme version consolidée', '2004-05-06', null, null, 'superseded', 'catalogued'),
  ('igoc-2026', 'Instruction Générale des Opérations de Change 2026', 'regulation', 'Office des Changes', 5, 'fr', 'https://www.oc.gov.ma/sites/default/files/reglementation/pdf/2026-01/IGOC%202026.pdf', 'IGOC 2026', null, '2026-01-01', null, 'active', 'catalogued'),
  ('cnss-employeur', 'Espace employeur · déclarations et cotisations', 'administrative_guidance', 'Caisse Nationale de Sécurité Sociale', 5, 'fr', 'https://www.cnss.ma/', 'Documentation employeur · vérifier les barèmes et périodes avant indexation', null, null, null, 'active', 'catalogued'),
  ('dgi-publications', 'Guides et publications fiscales de la DGI', 'administrative_guidance', 'Direction Générale des Impôts · Ministère de l’Économie et des Finances', 5, 'multi', 'https://www.finances.gov.ma/fr/Pages/publications.aspx', 'Utiliser les guides correspondant à l’exercice et au régime fiscal concernés', null, null, null, 'active', 'catalogued'),
  ('cnc-normes-index', 'Index officiel des normes et avis du CNC', 'accounting_standard', 'Conseil National de la Comptabilité · Ministère de l’Économie et des Finances', 5, 'fr', 'https://www.finances.gov.ma/fr/Nos-metiers/Pages/cnc-normes.aspx', 'Catalogue officiel des textes comptables et avis adoptés', null, null, null, 'active', 'catalogued'),
  ('bulletin-officiel-sgg', 'Bulletin Officiel · recherche des textes marocains', 'other', 'Secrétariat Général du Gouvernement · Imprimerie Officielle', 5, 'multi', 'https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx', 'Source de contrôle des lois, dahirs, décrets et arrêtés publiés', null, null, null, 'active', 'catalogued')
on conflict (source_key) do update set
  title = excluded.title,
  document_type = excluded.document_type,
  publisher = excluded.publisher,
  authority_level = excluded.authority_level,
  language = excluded.language,
  canonical_url = excluded.canonical_url,
  document_reference = excluded.document_reference,
  published_on = excluded.published_on,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  publication_status = excluded.publication_status,
  updated_at = now();

-- Preserve date-bounded old editions so answers for historical dates remain possible.
create or replace function public.search_knowledge_sources(
  query_text text,
  as_of_date date default current_date,
  result_limit integer default 6
)
returns table (
  chunk_id uuid, source_id uuid, source_key text, source_title text,
  document_type text, publisher text, authority_level smallint, language text,
  canonical_url text, document_reference text, published_on date,
  effective_from date, effective_to date, locator text, content text, relevance real
)
language sql stable security definer set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('simple'::regconfig, left(coalesce(query_text, ''), 1200)) as tsq
  ), ranked as (
    select
      chunk.id as chunk_id, source.id as source_id, source.source_key,
      source.title as source_title, source.document_type, source.publisher,
      source.authority_level, source.language, source.canonical_url,
      source.document_reference, source.published_on, source.effective_from,
      source.effective_to, chunk.locator, chunk.content,
      ts_rank_cd(chunk.search_vector, query.tsq) as relevance
    from public.knowledge_chunks chunk
    join public.knowledge_sources source on source.id = chunk.source_id
    cross join query
    where query.tsq <> ''::tsquery
      and chunk.search_vector @@ query.tsq
      and source.ingestion_status = 'ready'
      and source.publication_status in ('active', 'superseded', 'repealed')
      and (source.effective_from is null or source.effective_from <= coalesce(as_of_date, current_date))
      and (source.effective_to is null or source.effective_to >= coalesce(as_of_date, current_date))
      and (source.publication_status = 'active' or source.effective_to is not null)
  )
  select * from ranked
  order by relevance desc, authority_level desc, published_on desc nulls last
  limit greatest(1, least(coalesce(result_limit, 6), 10));
$$;

revoke all on function public.search_knowledge_sources(text, date, integer) from public, anon, authenticated;
grant execute on function public.search_knowledge_sources(text, date, integer) to service_role;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 117, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
