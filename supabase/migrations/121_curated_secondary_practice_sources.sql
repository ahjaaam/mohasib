-- Curated secondary reference material. These pages are not primary authority.
-- Each indexed passage is an original Mohasib editorial summary, not a quotation
-- from the linked article. Current legal conclusions still require an official
-- source passage in the same answer.

insert into public.knowledge_sources
  (source_key, title, document_type, publisher, authority_level, language,
   canonical_url, document_reference, published_on, effective_from,
   effective_to, publication_status, ingestion_status)
values
  ('pwc-ma-cit-2026', 'Morocco · Corporate taxes on income', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/corporate/taxes-on-corporate-income', 'Secondary tax summary · last reviewed 30 April 2026; verify against CGI 2026 and later DGI guidance', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-vat-2026', 'Morocco · Corporate other taxes and VAT', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/corporate/other-taxes', 'Secondary tax summary · last reviewed 30 April 2026; operation-specific VAT treatment must be checked in CGI 2026', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-cit-deductions-2026', 'Morocco · Corporate deductions', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/corporate/deductions', 'Secondary tax summary · last reviewed 30 April 2026; check the current CGI for eligibility and limits', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-cit-admin-2026', 'Morocco · Corporate tax administration', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/corporate/tax-administration', 'Secondary tax summary · last reviewed 30 April 2026; confirm deadlines and penalties in current official texts', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-cit-developments-2026', 'Morocco · Corporate tax developments', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/corporate/significant-developments', 'Secondary tax summary · last reviewed 30 April 2026; use as an issue checklist, not as the enacted text', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-iit-2026', 'Morocco · Individual income tax', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/individual/taxes-on-personal-income', 'Secondary tax summary · last reviewed 30 April 2026; determine residency and income category from current law', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-iit-deductions-2026', 'Morocco · Individual deductions', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/individual/deductions', 'Secondary tax summary · last reviewed 30 April 2026; verify taxpayer eligibility and caps in current CGI', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-iit-admin-2026', 'Morocco · Individual tax administration', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/individual/tax-administration', 'Secondary tax summary · last reviewed 30 April 2026; verify declarations and deadlines in current official texts', null, null, null, 'active', 'catalogued'),
  ('pwc-ma-social-security-2026', 'Morocco · Individual social security', 'professional_guidance', 'PwC · Worldwide Tax Summaries', 3, 'en', 'https://taxsummaries.pwc.com/morocco/individual/other-taxes', 'Secondary tax summary · last reviewed 30 April 2026; CNSS rates and bases require confirmation against current CNSS material', null, null, null, 'active', 'catalogued'),
  ('upsilon-ma-financial-statements-2026', 'États de synthèse au Maroc · bilan, CPC, ESG, tableau de financement et ETIC', 'professional_guidance', 'Upsilon Consulting', 3, 'fr', 'https://www.upsilon-consulting.com/etats-synthese-maroc/', 'Article de Yassine Benjelloun Touimi · publié le 12 mai 2026 · résumé Mohasib, pas un extrait', '2026-05-12', null, null, 'active', 'catalogued'),
  ('nexora-ma-social-payroll-2026', 'Mission sociale au Maroc · paie, CNSS, AMO et DAMANCOM', 'professional_guidance', 'NEXORA Expertise Comptable, Audit et Conseils', 3, 'fr', 'https://nexora-expertise.ma/articles/mission-sociale-expert-comptable-maroc-2026-paie-cnss-amo-code-travail-damancom', 'Guide professionnel 2026 · résumé Mohasib, pas un extrait · montants et échéances à confirmer aux sources primaires', null, null, null, 'active', 'catalogued'),
  ('izri-ma-payroll-entries', 'Écritures comptables de paie au Maroc · exemple PCGE', 'professional_guidance', 'IZRI Guide', 2, 'fr', 'https://guide.izri.ma/ecritures-paie-maroc-cnss-amo-ir/', 'Exemple pédagogique de fournisseur logiciel · date de mise à jour non confirmée · comptes et calculs à valider avant usage', null, null, null, 'active', 'catalogued'),
  ('izri-ma-year-end-close', 'Écritures de clôture au Maroc · checklist PCGE', 'professional_guidance', 'IZRI Guide', 2, 'fr', 'https://guide.izri.ma/ecritures-cloture-exercice-maroc/', 'Checklist pédagogique · mise à jour annoncée le 20 janvier 2026 · méthodes et écritures à valider au CGNC/PCGE', null, null, null, 'active', 'catalogued')
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

-- The passage text is an original, high-level index summary. It intentionally
-- excludes secondaries' rates, thresholds, deadlines, and sanctions.
insert into public.knowledge_chunks (source_id, chunk_index, locator, content)
select source.id, 0, 'Résumé éditorial Mohasib · sujet traité par l’article (pas une citation)', excerpt.content
from (values
  ('pwc-ma-cit-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Le guide de l’impôt sur les sociétés au Maroc traite de la détermination du résultat imposable, des charges déductibles, des taux, de la cotisation minimale et de certains régimes particuliers. Utiliser ce guide pour repérer la question et les exceptions à examiner; pour conclure sur une société et un exercice précis, consulter les articles du CGI 2026 et les textes officiels applicables.'),
  ('pwc-ma-vat-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Le guide TVA recense le champ de la taxe, les opérations concernées et des catégories de taux, avec une transition de taux décrite jusqu’en 2026. Le traitement dépend de l’opération, du produit ou service, du régime et de la date; vérifier les dispositions précises du CGI 2026 et de la loi de finances applicable.'),
  ('pwc-ma-cit-deductions-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Le guide présente des thèmes de détermination du résultat fiscal: amortissements, frais de démarrage, intérêts, créances irrécouvrables, dons, pénalités et reports déficitaires. Les conditions, plafonds, preuves et durées varient selon la règle; ne pas déduire l’éligibilité d’un poste de cette synthèse sans vérifier le CGI 2026 et les faits.'),
  ('pwc-ma-cit-admin-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Le guide aborde la période imposable, les déclarations et paiements de l’IS, les acomptes, les majorations et les délais de reprise. Pour répondre à une échéance, une pénalité ou une situation de régularisation, vérifier la version applicable du CGI, la loi de finances et les consignes DGI à la date de référence.'),
  ('pwc-ma-cit-developments-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Cette page signale des évolutions fiscales concernant notamment la TVA, l’IS, les retenues à la source et certaines contributions. Elle sert de liste de sujets à contrôler; le texte promulgué et la note circulaire DGI correspondante sont nécessaires pour établir l’entrée en vigueur, les personnes concernées et les modalités.'),
  ('pwc-ma-iit-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Le guide décrit les catégories de revenus des personnes physiques, le rôle de la résidence fiscale et le barème progressif de l’IR. La résidence, la source du revenu, la catégorie fiscale et les conventions peuvent modifier l’analyse; vérifier les dispositions du CGI 2026 et les circonstances du contribuable.'),
  ('pwc-ma-iit-deductions-2026', 'Référence secondaire PwC, revue le 30 avril 2026. Le guide couvre les frais professionnels, les pensions, les cotisations d’assurance-retraite, les dons et les intérêts d’emprunt pour résidence principale comme thèmes de déduction à l’IR. Les plafonds et conditions dépendent de la catégorie de revenu et du contribuable; vérifier le CGI 2026 avant tout calcul.'),
  ('pwc-ma-iit-admin-2026', 'Référence secondaire PwC, revue le 30 avril 2026. La page traite des retenues sur salaires, des situations où une déclaration personnelle peut être nécessaire, des délais et du délai de reprise. Elle peut aider à identifier les cas à examiner, mais la réponse à un dossier concret doit être confirmée dans les textes DGI en vigueur.'),
  ('pwc-ma-social-security-2026', 'Référence secondaire PwC, revue le 30 avril 2026. La page rassemble des informations sur les prélèvements sociaux des salariés, l’AMO et la CNSS. Elle ne remplace pas les barèmes, plafonds, affiliations ou instructions officielles CNSS en vigueur pour la période de paie concernée; ne pas calculer une paie à partir de ce résumé seul.'),
  ('upsilon-ma-financial-statements-2026', 'Résumé éditorial d’un article Upsilon publié en mai 2026 et revu en septembre 2026, pas une citation textuelle. L’article explique les états de synthèse marocains — bilan, CPC, ESG, tableau de financement et ETIC — et leur lecture comme vues complémentaires du patrimoine, du résultat, des soldes de gestion, des flux de financement et des informations annexes. Les modèles applicables, obligations et délais doivent être vérifiés dans la loi 9-88, le CGNC et les textes de société pertinents.'),
  ('nexora-ma-social-payroll-2026', 'Résumé éditorial d’un guide professionnel de paie 2026, pas une citation textuelle. Le guide organise la mission sociale autour du contrat et du dossier salarié, du bulletin de paie, des déclarations, de la CNSS, de l’AMO, de l’IR salarial et des contrôles de cohérence. Il aide à structurer une checklist; taux, seuils, délais, sanctions et mentions obligatoires nécessitent une vérification dans les textes et instructions officiels.'),
  ('izri-ma-payroll-entries', 'Résumé éditorial d’un exemple pédagogique, pas une citation textuelle. L’article illustre le flux d’écritures de paie: constater le salaire brut et les retenues, enregistrer les charges patronales, payer le net, puis solder les dettes envers les organismes sociaux et l’État. Les numéros de comptes, taux et montants de l’exemple ne sont pas une règle officielle; les vérifier avec le PCGE, le dossier de paie et les sources CNSS/DGI applicables.'),
  ('izri-ma-year-end-close', 'Résumé éditorial d’une checklist pédagogique, pas une citation textuelle. L’article organise la clôture comptable autour de l’inventaire, des régularisations, de l’examen des immobilisations et amortissements, des provisions, du rapprochement des comptes et de la préparation des états de synthèse. Il peut aider à préparer une liste de contrôle; les écritures et méthodes dépendent du CGNC/PCGE et de la situation réelle.')
) as excerpt(source_key, content)
join public.knowledge_sources source on source.source_key = excerpt.source_key
on conflict (source_id, chunk_index) do update
set locator = excluded.locator, content = excluded.content;

update public.knowledge_sources source
set ingestion_status = 'ready', chunk_count = 1,
    last_verified_at = now(), ingest_error = null, updated_at = now()
where source.source_key in (
  'pwc-ma-cit-2026', 'pwc-ma-vat-2026', 'pwc-ma-cit-deductions-2026',
  'pwc-ma-cit-admin-2026', 'pwc-ma-cit-developments-2026', 'pwc-ma-iit-2026',
  'pwc-ma-iit-deductions-2026', 'pwc-ma-iit-admin-2026',
  'pwc-ma-social-security-2026', 'upsilon-ma-financial-statements-2026',
  'nexora-ma-social-payroll-2026', 'izri-ma-payroll-entries', 'izri-ma-year-end-close'
);

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 121, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
