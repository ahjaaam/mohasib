-- First searchable passages for two important gaps in the launch library.
-- The passages below are deliberately limited to what the cited official
-- materials explicitly say; they do not establish contribution rates or
-- every employer's case-specific filing obligations.

insert into public.knowledge_sources
  (source_key, title, document_type, publisher, authority_level, language,
   canonical_url, document_reference, published_on, effective_from,
   effective_to, publication_status, ingestion_status)
values
  ('cnss-employer-amo-duties',
   'Obligations des employeurs au titre de la couverture médicale de base',
   'administrative_guidance',
   'Ministère de la Solidarité, du Développement social, de l’Égalité et de la Famille',
   5, 'fr',
   'https://social.gov.ma/questions-frequemment-posees/droits-des-femmes-dans-les-lois-relatives-a-la-securite-sociale/',
   'FAQ ministérielle citant les articles 94 à 98 du Code de la couverture médicale de base',
   null, null, null, 'active', 'catalogued')
on conflict (source_key) do update set
  title = excluded.title,
  document_type = excluded.document_type,
  publisher = excluded.publisher,
  authority_level = excluded.authority_level,
  language = excluded.language,
  canonical_url = excluded.canonical_url,
  document_reference = excluded.document_reference,
  updated_at = now();

update public.knowledge_sources
set ingestion_status = 'ready', chunk_count = 2,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source_key = 'cnc-avis-24';

update public.knowledge_sources
set ingestion_status = 'ready', chunk_count = 2,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source_key = 'cnss-employer-amo-duties';

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, excerpt.chunk_index, excerpt.locator, excerpt.content
from (
  values
    (0, 'Avis CNC n° 24 · objet et fondement',
     'Le Ministère de l’Économie et des Finances indique que l’avis n° 24 du Conseil National de la Comptabilité porte sur les principes et critères de la comptabilité normalisée tenue au moyen de traitements informatiques. La page ministérielle le rattache à l’article 145 du Code Général des Impôts, modifié par la loi de finances n° 68-17 pour 2018, qui prévoit une tenue de la comptabilité sous format électronique selon des critères fixés par voie réglementaire. Source publiée le 14 juin 2023; vérifier le CGI et les textes applicables à la date de référence.'),
    (1, 'Avis CNC n° 24 · logiciel comptable et FEC',
     'Selon la présentation officielle du Ministère de l’Économie et des Finances, l’avis CNC n° 24 définit la comptabilité normalisée tenue sur traitement informatique, fixe des critères et principes de base pour les logiciels de production comptable, et décrit la liste ainsi que le format des informations devant figurer dans le fichier des écritures comptables (FEC). La page est datée du 14 juin 2023. Elle ne suffit pas, à elle seule, à déterminer les exigences fiscales courantes d’une entreprise donnée.')
) as excerpt(chunk_index, locator, content)
join public.knowledge_sources source on source.source_key = 'cnc-avis-24'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, excerpt.chunk_index, excerpt.locator, excerpt.content
from (
  values
    (0, 'FAQ ministérielle · affiliation et immatriculation',
     'Le Ministère de la Solidarité indique que les employeurs concernés doivent affilier leur établissement ou entreprise à la CNSS ou à la CNOPS selon le régime applicable, et immatriculer l’ensemble des salariés auprès de l’organisme concerné. La page vise le régime de couverture médicale de base; vérifier séparément le régime social applicable à l’employeur et au salarié.'),
    (1, 'FAQ ministérielle · déclarations périodiques et paiement',
     'Pour l’assurance maladie obligatoire de base, la FAQ ministérielle indique que les employeurs communiquent périodiquement à l’organisme gestionnaire la liste nominative des salariés, l’assiette de cotisation et le montant dû. L’employeur doit pouvoir justifier son affiliation et le paiement à jour des cotisations salariales et contributions patronales, le cas échéant. La page renvoie aux articles 94 à 98 du Code de la couverture médicale de base; elle ne fournit ni taux ni échéance précise.')
) as excerpt(chunk_index, locator, content)
join public.knowledge_sources source on source.source_key = 'cnss-employer-amo-duties'
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 120, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
