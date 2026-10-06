-- A minimal, source-backed starter corpus so the preloaded SARL question has
-- useful answers on first run. Excerpts are from the official Ministry of
-- Justice consolidation of Law 5-96 dated 19 August 2021 and the official
-- Ministry of Justice Commercial Code consolidation dated 19 December 2019.
update public.knowledge_sources
set ingestion_status = 'ready',
    chunk_count = 4,
    last_verified_at = now(),
    ingest_error = null,
    updated_at = now()
where source_key = 'law-5-96-consol-2021';

update public.knowledge_sources
set ingestion_status = 'ready',
    chunk_count = 1,
    last_verified_at = now(),
    ingest_error = null,
    updated_at = now()
where source_key = 'code-commerce-consol-2019';

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, excerpt.chunk_index, excerpt.locator, excerpt.content
from (
  values
    (0, 'Page 32 · Article 70',
     'Loi n° 5-96 sur les sociétés commerciales, version consolidée par le Ministère de la Justice au 19 août 2021. Article 70 (SARL) : le rapport de gestion, l’inventaire et les états de synthèse établis par les gérants sont soumis à l’approbation des associés réunis en assemblée dans les six mois suivant la clôture de l’exercice. Les documents, projets de résolutions et, le cas échéant, rapport du commissaire aux comptes sont adressés aux associés au moins quinze jours avant l’assemblée.'),
    (1, 'Page 36 · Article 76',
     'Loi n° 5-96 sur les sociétés commerciales, version consolidée par le Ministère de la Justice au 19 août 2021. Article 76 (SARL à associé unique) : le rapport de gestion, l’inventaire et les états de synthèse sont établis par le gérant. L’associé unique approuve les comptes, le cas échéant après rapport du commissaire aux comptes, dans les six mois suivant la clôture de l’exercice. Ses décisions sont répertoriées dans un registre.'),
    (2, 'Page 38 · Article 80',
     'Loi n° 5-96 sur les sociétés commerciales, version consolidée par le Ministère de la Justice au 19 août 2021. Article 80 (SARL) : un ou plusieurs commissaires aux comptes peuvent être nommés. La désignation d’au moins un commissaire aux comptes est obligatoire lorsque le chiffre d’affaires hors taxes à la clôture d’un exercice dépasse 50 millions de dirhams. En dessous de ce seuil, un ou plusieurs associés représentant au moins le quart du capital peuvent demander au président du tribunal de désigner un commissaire aux comptes.'),
    (3, 'Page 43 · Article 95',
     'Loi n° 5-96 sur les sociétés commerciales, version consolidée par le Ministère de la Justice au 19 août 2021. Article 95 : les sociétés commerciales déposent au greffe du tribunal du siège social, dans les trente jours suivant l’approbation par l’assemblée générale, deux exemplaires des états de synthèse et, le cas échéant, deux exemplaires du rapport du commissaire aux comptes.')
) as excerpt(chunk_index, locator, content)
join public.knowledge_sources source on source.source_key = 'law-5-96-consol-2021'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, 0, 'Page 9 · Article 19',
  'Loi n° 15-95 formant Code de commerce, version consolidée par le Ministère de la Justice au 19 décembre 2019. Article 19 : le commerçant tient une comptabilité conformément à la loi n° 9-88 relative aux obligations comptables des commerçants. Une comptabilité régulièrement tenue peut être admise par le juge comme preuve entre commerçants pour les faits de commerce.'
from public.knowledge_sources source
where source.source_key = 'code-commerce-consol-2019'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 119, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
