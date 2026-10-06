-- Expand the launch corpus with additional passages checked against official
-- MEF, Bulletin Officiel, and Office des Changes publications. These are
-- scoped excerpts/summaries; they do not claim to be full-text PDF imports.

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, excerpt.chunk_index, excerpt.locator, excerpt.content
from (
  values
    (0, 'Loi n° 44-03 · article 4 · chiffre d’affaires supérieur à 10 MDH',
     'La loi n° 44-03 modifiant la loi n° 9-88 prévoit que les personnes assujetties à cette loi dont le chiffre d’affaires annuel dépasse 10 000 000 DH établissent un manuel décrivant l’organisation comptable de leur entreprise. Source primaire : texte de la loi n° 44-03 publié par le Ministère de l’Économie et des Finances. Ce passage ne précise pas les autres conditions d’application de la loi n° 9-88.'),
    (1, 'Loi n° 44-03 · article 8 · conservation pour certaines personnes physiques',
     'La loi n° 44-03 prévoit une exception à la cotation et au paraphe du livre-journal et du livre d’inventaire pour les personnes physiques visées au cinquième alinéa de l’article 1 de la loi n° 9-88, sous condition de conserver ces livres, le bilan et le compte de produits et charges pendant dix ans. Il faut vérifier que la personne relève bien de cette catégorie avant d’appliquer l’exception.')
) as excerpt(chunk_index, locator, content)
join public.knowledge_sources source on source.source_key = 'law-44-03-accounting'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

update public.knowledge_sources source
set ingestion_status = 'ready', chunk_count = 2,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source.source_key = 'law-44-03-accounting';

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, excerpt.chunk_index, excerpt.locator, excerpt.content
from (
  values
    (0, 'Avis CNC n° 25 · cadre et modèles comptables',
     'Le Ministère de l’Économie et des Finances indique que l’avis CNC n° 25 porte sur les règles comptables des syndicats de copropriétaires, prises en application de l’article 24 de la loi n° 18-00. Le cadre couvre les principes comptables, la nomenclature et le fonctionnement des comptes ainsi que les états de synthèse. Deux modèles sont prévus : simplifié pour les syndicats de petite taille et développé lorsque les produits annuels dépassent 200 000 DH. Source : présentation officielle MEF du 14 juin 2023.'),
    (1, 'Avis CNC n° 25 · contrôle des comptes et entrée en vigueur',
     'La présentation officielle du MEF indique qu’un rapport de contrôle des comptes du syndicat par un expert-comptable est obligatoire lorsque les produits annuels dépassent 1 000 000 DH. Elle précise également que les règles comptables de l’avis n° 25 entrent en vigueur à la date fixée par le décret pris en application de l’article 24 de la loi n° 18-00. Vérifier le décret d’entrée en vigueur avant de présenter ces règles comme applicables à une période donnée.')
) as excerpt(chunk_index, locator, content)
join public.knowledge_sources source on source.source_key = 'cnc-avis-25'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

update public.knowledge_sources source
set ingestion_status = 'ready', chunk_count = 2,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source.source_key = 'cnc-avis-25';

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, 0, 'CGI 2026 · article 145-I · texte officiel applicable à partir de 2026',
  'Le CGI 2026, tel que modifié par la loi de finances n° 50-25, prévoit à l’article 145-I que la comptabilité doit être tenue sous format électronique conformément à la législation et à la réglementation en vigueur. Le texte de la loi de finances n° 50-25 a été publié au Bulletin Officiel n° 7465 bis; le CGI 2026 est publié par la DGI. Ce passage n’établit pas de format technique ou de calendrier au-delà de ce qui figure dans les textes d’application en vigueur.'
from public.knowledge_sources source
where source.source_key = 'cgi-2026'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

update public.knowledge_sources source
set ingestion_status = 'ready', chunk_count = 1,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source.source_key = 'cgi-2026';

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, excerpt.chunk_index, excerpt.locator, excerpt.content
from (
  values
    (0, 'IGOC 2026 · préambule · structure et date d’application',
     'L’Office des Changes présente l’IGOC 2026 comme un texte de 256 articles organisés en six chapitres. Les deux premiers posent les dispositions générales applicables aux opérations de change; les quatre suivants traitent des opérations courantes, des opérations en capital et des comptes prévus par la réglementation. L’Office indique une entrée en vigueur au 1er janvier 2026. Ce résumé de structure aide à orienter la recherche, mais ne remplace pas les articles applicables à une opération déterminée.'),
    (1, 'IGOC 2026 · thèmes signalés par l’Office des Changes',
     'Dans son communiqué de publication, l’Office des Changes signale que l’IGOC 2026 traite notamment de l’investissement, des exportations, du commerce électronique, des voyages d’affaires, de l’importation de services et des instruments de couverture. Pour déterminer les justificatifs, plafonds, procédures ou autorisations applicables, consulter l’article pertinent du texte intégral et les circulaires postérieures.')
) as excerpt(chunk_index, locator, content)
join public.knowledge_sources source on source.source_key = 'igoc-2026'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

update public.knowledge_sources source
set canonical_url = 'https://www.oc.gov.ma/sites/default/files/reglementation/pdf/2026-01/IGOC%202026_0.pdf',
    document_reference = 'Instruction Générale des Opérations de Change 2026 · 256 articles · entrée en vigueur indiquée au 1er janvier 2026',
    ingestion_status = 'ready', chunk_count = 2,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source.source_key = 'igoc-2026';

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 122, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
