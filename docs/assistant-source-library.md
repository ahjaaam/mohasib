# Mohasib research assistant: source library

## Current MVP flow

The launch scope is Moroccan accounting, tax, SARL/company duties, payroll, and CNSS. Questions with no recognizable connection to these domains receive a short scope explanation before retrieval. In-scope questions still require source passages; missing coverage is reported separately.

1. Migrations `115_mohasib_knowledge_library.sql` and `117_curated_moroccan_source_catalog.sql` create and seed the source register. Catalog entries are acquisition targets: ingest their documents or verified excerpts into searchable passages, then mark them ready. A listing page or a link without indexed text remains catalogued.
2. `/admin/assistant-sources` is the content-management interface. An administrator creates or selects a source, edits its metadata, then pastes verified source text or uploads its text-readable PDF.
3. Pasted text is preserved in `knowledge_sources.source_text`, divided into overlapping passages, and indexed in Postgres full-text search. Re-saving the same source replaces its searchable passages. PDFs are stored in the private `mohasib-knowledge` Supabase Storage bucket; their page text is extracted and indexed, with page and detected article locators where available.
4. The answer API retrieves only indexed passages that match the requested date, passes those passages to Anthropic, and accepts citations only when their passage IDs came from retrieval.
5. If no passages match, or the model cannot support an answer with them, the API returns an explicit no-source / no-support state. It does not answer from model memory.

## Authority and dates

`authority_level` is a curator-assigned scale: 5 for legislation, standards, and official material; 4 for professional guidance; 3 for established practitioner material; 2 for secondary research; 1 for context only. Search uses `ingestion_status = ready` and the source's effective dates. Date-bounded active, superseded, or repealed editions can support questions for the matching historical date. Old editions without a verified `effective_to` date are excluded once superseded/repealed.

Every record should have its original publisher, canonical HTTPS URL, language, document reference, publication date when known, and effective period. Do not guess dates. Verify the original PDF and its amendment history before treating it as current.

## Curated first wave

Migration `117_curated_moroccan_source_catalog.sql` refreshes the catalog with specific official editions and stable document identifiers. It covers:

- **Tax:** CGI 2026 (French and Arabic), the enacted 2026 Finance Law, and DGI Circular 737 explaining its fiscal measures.
- **Company and commercial law:** Ministry of Justice consolidations of Law 5-96 (including SARLs) to 19 August 2021 and Commercial Code 15-95 to 19 December 2019.
- **Accounting:** Law 9-88, its amending Law 44-03, the CGNC, CNC Opinions 1/2 and 24/25, and the CNC official index.
- **Payroll and cross-border operations:** CNSS employer documentation and Office des Changes IGOC 2026. The Labour Code's original 2004 Bulletin Officiel text is catalogued as superseded and must not be indexed alone as current law; add a current consolidated edition plus the applicable amendments first.
- **Verification:** official DGI publication listings and the SGG Bulletin Officiel search portal.

Most records are **catalog entries**, not searchable passages. The searchable starter set is:

- Migration `119_seed_sarl_accounting_excerpts.sql`: five excerpts from the official Justice Ministry consolidations of Law 5-96 (19 August 2021) and the Commercial Code (19 December 2019).
- Migration `120_seed_cnc_and_cnss_excerpts.sql`: two excerpts describing CNC Opinion 24 (MEF page dated 14 June 2023) and two excerpts from the Social Development Ministry FAQ on employer affiliation, employee registration, periodic AMO reporting, and proof of contribution payment. The FAQ cites Code 65-00 articles 94–98; it does not supply rates or deadlines.
- Migration `122_expand_official_source_passages.sql`: two excerpts from Law 44-03 on the accounting manual threshold and a specific books-retention exception; two MEF passages on CNC Opinion 25; a CGI 2026 Article 145-I passage; and two official Office des Changes passages describing IGOC 2026's scope and structure. These are limited excerpts or source summaries, not full-text PDF ingestions.
- Migration `121_curated_secondary_practice_sources.sql`: 13 searchable, original Mohasib summaries of PwC Worldwide Tax Summaries (nine tax/payroll topics, reviewed 30 April 2026), one Upsilon financial-statements explainer, one NEXORA social-payroll guide, and two IZRI bookkeeping examples. These summaries are labeled as secondary and are not quotations. Their source entries identify the publisher, original URL, review/publication information where available, and limits.

These passages make the covered topics searchable; they do not replace the primary full-text PDFs or certify that every later amendment has been checked. CGI 2026, Finance Law 2026, DGI circular 737, the complete Laws 9-88/44-03, CGNC, labour rules, the full IGOC 2026, and CNSS contribution schedules still need full-text official imports. Do not answer current rates, payroll computations, filing deadlines, or tax calculations from catalogue metadata or secondary-source summaries alone. Import original official PDFs through `/admin/assistant-sources`, then review the passages and effective dates before marking them ready.

## Secondary source policy

- Secondary items use `authority_level` 1–3. They can provide explanations, practice context, checklists, and leads to topics for official-source review.
- For legal obligations, tax or social-security rates, thresholds, deadlines, penalties, and current calculations, the answer must cite at least one matching primary/official passage (`authority_level` 4–5). The answer API refuses an answer whose selected citations contain only secondary material.
- A secondary-only topic summary is not a quotation from the article. The source panel labels it “Résumé éditorial Mohasib · source secondaire”; it links to the original page.
- Numeric examples, vendor examples, and legal conclusions from professional blogs must be checked against the current law, administrative guidance, or applicable accounting standard before they are indexed as answer-supporting material.
- The first secondary wave favors regularly reviewed professional references and clearly dated local practitioner explainers. It excludes undated or stale pages and does not index user forums as professional authority.

Start with these PDFs because they cover common first questions:

1. CGI 2026 French edition.
2. DGI Circular 737 on Finance Law 2026.
3. Finance Law 2026 enacted text.
4. Law 5-96, consolidation to 19 August 2021, for SARL questions.
5. Law 9-88 together with amending Law 44-03, for bookkeeping duties.
6. CGNC, for accounting treatment and financial statements.
7. Commercial Code 15-95, consolidation to 19 December 2019, for merchant and commercial obligations.
8. CNC Opinion 24, for electronic accounting records.
9. IGOC 2026, for foreign-currency questions.

For entries that point to an official publications index, choose the edition matching the catalog title and retain its original PDF. Never import a draft law or a consultant's summary as enacted law. Before indexing a consolidated law, check its cover page and amendment list against the current SGG or Ministry edition.

## Update and version policy

- **Fiscal codes and Finance Laws:** review DGI/MEF publications at the start of every fiscal year and after each Finance Law or DGI circular. Keep each edition under a distinct key such as `cgi-2026` or `dgi-nc-737-lf2026`.
- **Company and commercial legislation:** check SGG and Ministry of Justice consolidated texts quarterly, and when an amending law appears in the Bulletin Officiel. Store each consolidation as its own dated version.
- **Accounting standards:** review CNC norms and communications quarterly. New CNC opinions may change a topic without replacing the full CGNC.
- **Social security, payroll and foreign exchange:** check CNSS and Office des Changes at least quarterly and whenever an annual schedule or circular is released. Version rates and annual instructions by their effective period.
- **At every import:** record the PDF's stated edition, publication date, effective start/end dates, official publisher, and canonical URL. Compare it with the prior edition, store its checksum (the ingestion flow does this), and record the curator's verification date. Do not invent dates. If the effective period is unclear, leave it blank and do not claim a dated rule.
- **When a new edition arrives:** keep the old PDF and chunks, give the new edition a new source key, set the old edition's verified `effective_to`, and mark it `superseded`. Migration 117 keeps date-bounded superseded/repealed texts available for historical questions while excluding unbounded old editions.
- **If no official consolidated text is available:** index the original law and verified amending texts separately, with clear references. Never label the original text “consolidated.”

`last_verified_at` is set during successful ingestion. Treat it as the date the curator checked and imported that edition, not proof that the publisher has not since changed it. Revisit the official page on the schedule above and re-import when its edition changes.

## MVP limits

- Search uses Postgres full-text matching, not semantic embeddings. It is cheap and source-transparent, but may miss paraphrases; add reviewed synonyms or semantic search after collecting real unanswered questions.
- Migration `118_resilient_knowledge_retrieval.sql` retries broad natural-language questions against meaningful terms when the full question has no exact match. This improves recall; it does not create source coverage. If no indexed passage supports the topic, Mohasib must state that limitation instead of answering from Claude's general memory.
- Migrations `119` and `120` index selected passages from official Ministry sources. They support a first answer about SARL annual accounts, approval and filing; the high-level purpose of CNC Opinion 24 and FEC; and basic employer CNSS/AMO duties. Migration `121` adds secondary practitioner context; it cannot establish a current legal rule by itself. The SARL editions are dated and the CNC page is from 2023, so the answer must disclose those dates where relevant and must not claim later amendments were checked. The CNSS passage is an official ministry FAQ rather than the underlying statute and supports only the general duties it states.
- “Any professional question” is a product direction, not a guarantee the MVP can honestly make. Coverage expands only as each domain's current primary materials are collected, indexed, checked for effective dates, and tested against real practitioner questions. High-risk calculations and deadlines should require current source passages and enough user facts to determine applicability.
- PDF ingestion requires a readable text layer. Scanned PDFs need OCR before upload.
- The answer quota is 100 model-backed responses per user per calendar month, plus an IP rate limit. A query with no matching sources does not call the model.
- The answer API does not retain questions or answers. Source documents and searchable passages are centrally managed; user files are not part of this corpus.
