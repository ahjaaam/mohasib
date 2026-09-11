# Mohasib Consumer Readiness Review

**Review date:** 10 September 2026  
**Candidate reviewed:** local repository at `5831da76bb425ff1d4b14a49d2b0fabacbc529ad`, including the current uncommitted changes  
**Production observed:** `https://app.mohasibai.com`, reporting version `b1a122b1cc86`  
**Decision:** **The confirmed invoice/journal, payment, and 0% VAT lifecycle defects are fixed in the working tree. Overall consumer readiness remains conditional on applying migrations 105–107 and passing the database-backed staging and operational release gates below.**

## Executive conclusion

The application builds successfully, its current unit test suite passes, and the ordinary Entries screen is read-only. After a skeptical second pass limited to enabled, normal user workflows, some original findings were downgraded or removed. ACCT-02 was fixed with atomic draft finalization and migration 105. ACCT-03 and ACCT-04 were fixed with dated payment evidence, an atomic database payment function, legacy payment reconciliation, and migration 106. ACCT-07 is now fixed by explicit 0% treatment classification, automatic turnover aggregation, validation safeguards, and migration 107.

The remaining release risk is operational assurance rather than a reproduced blocker in these corrected invoice/payment/VAT paths: the migrations have not yet been exercised against a clean staging database with authenticated end-to-end and RLS tests.

It is not technically possible to promise “no single issue.” A responsible public-release decision should instead require all critical accounting invariants, representative end-to-end workflows, database policies, backups, and operational recovery to pass documented tests. The current candidate does not meet that bar.

Public legal placeholder pages were excluded as requested.

## Reassessment of the original blockers

| Original finding | Rechecked classification | Release decision effect |
|---|---|---|
| Individual journal-line edit/delete | **Removed as a current-user blocker.** Entries is read-only and the mutation APIs return 403 while manual entry is disabled. | None while the feature remains disabled. |
| Invoice ↔ journal lifecycle | **Originally confirmed, now fixed in the working tree.** Drafts remain outside the ledger; finalization books and changes status atomically; finalized deletion is blocked. | Apply migration 105 before deploying the new code. |
| “Mark paid” ↔ cash VAT | **Originally confirmed, now fixed in the working tree.** Every normal invoice-payment action captures dated evidence through the payment service. | Apply migration 106 before deploying the new code. |
| Manual-payment atomicity | **Originally confirmed, now fixed in the working tree.** Invoice payment evidence and derived invoice state are committed by one row-locking database function. | Apply migration 106 before deploying the new code. |
| Monthly Reports expenses | **Confirmed calculation defect, but the navigation labels Reports “Bientôt.”** | Preview-feature defect, not a core launch blocker if it is clearly excluded from the released feature set. |
| Dossier Bilan/CPC | **Confirmed code defect but feature-disabled.** | None while `BILAN_ENABLED` remains false. |
| 0% invoice VAT classification | **Originally confirmed, now fixed in the working tree.** New 0% invoices and credit notes require a treatment before issue; legacy unclassified bases remain visible and block VAT validation. | Apply migration 107 before deploying the new code. |
| Local E2E readiness and production public-nav smoke | **Operational/test-environment findings.** | Require resolution for release confidence, but they do not demonstrate an accounting error in a signed-in user's normal workflow. |

## Findings reassessed

### ACCT-01 — Disabled manual-entry APIs lack whole-journal balance protection

**Severity:** High latent risk; not exposed in the current read-only Entries UI  
**Evidence:** read-only UI at `src/app/(app)/ecritures/page.tsx:189-223` and `src/components/EcrituresTable.tsx:66-118`; feature gate at `src/lib/features.ts:7`; disabled response at `src/lib/api-features.ts:5-15`; mutation handlers at `src/app/api/ecritures/[id]/route.ts:31-44,50-64` and `src/app/api/dossier-ecritures/[id]/route.ts:43-55,61-78`

The current `/ecritures` screen only renders, sorts, filters, and links rows; it does not offer edit or delete controls. Manual entry is disabled by default, and these API handlers return HTTP 403 unless `NEXT_PUBLIC_SAISIE_ENABLED=true`.

The dormant mutation handlers nevertheless update or delete a single debit/credit row without validating the balance of the complete journal entry. The company-journal path also lacks a period-lock check. If manual entry is enabled in any environment, an authenticated owner could invoke those handlers and create unbalanced books.

**Required action:** Keep manual entry disabled. Before ever enabling it, replace single-line mutation with a database transaction operating on the whole journal batch. Enforce debit = credit, ownership, source integrity, and period lock in the database transaction, with tests for edits, deletes, concurrent changes, and closed periods.

### ACCT-02 — Invoice and journal lifecycles are not synchronized

**Status:** Resolved in the current working tree by migration 105 and the accompanying invoice finalization changes; deployment still requires applying the migration before serving the new code.  
**Original severity:** Critical / release blocker for accounting use  
**Evidence:** `src/app/(app)/invoices/new/NewInvoiceForm.tsx:256-343`; `src/app/api/accounting/book/route.ts:59-82`; `src/app/(app)/invoices/[id]/edit/EditInvoiceForm.tsx:87-124`; `src/app/(app)/invoices/page.tsx:586-592,757-770`; `supabase/migrations/016_ecritures_comptables.sql:3-30`

After inserting an invoice, the browser starts accounting booking as an unawaited, fire-and-forget request. The request is sent for both `draft` and `sent` invoices. This is an ordinary reachable flow: the draft menu then exposes both **Modifier** and **Supprimer**. The invoice booking branch does not validate invoice status or enforce the period lock. Editing directly changes accounting-relevant fields without reversing/rebuilding the journal, and deletion does not remove or reverse journal entries. `source_id` is not a foreign key.

The newer booking-batch uniqueness control prevents duplicate initial booking, which is useful, but it does not solve edits/deletes. If journal lines disappear while the batch marker remains, retrying cannot reconstruct the booking through the existing endpoint.

**Consumer impact:** The invoice can show one amount or status while the ledger contains another; a draft can affect the books; a navigation/network interruption can leave an invoice unbooked; deleting an invoice can leave orphan accounting entries.

**Required release gate:** Use one server-side transactional lifecycle: validate invoice state, save/finalize, book balanced entries, and commit together. Define immutable finalized invoices plus credit-note/reversal flows. Enforce period locks on all accounting-effective changes.

### ACCT-03 — “Mark paid” bypasses the payment evidence used by VAT

**Status:** Resolved in the current working tree by migration 106 and the invoice-payment UI/API changes; deployment still requires applying migrations 105 and 106 before serving the new code.  
**Original severity:** Critical / release blocker for the default cash-basis workflow  
**Resolution:** The invoice detail action now opens the dated payment form, which records a confirmed `invoice_payments` row through `/api/invoice-payments`. List shortcuts lead to that form, the evidence-free bulk paid action was removed, and drafts cannot be paid before finalization. The database rejects paid/partial summary increases without confirmed collection evidence. Migration 106 promotes valid legacy JSON payment history and returns unsupported status-only paid invoices to an outstanding state rather than inventing payment dates.

### ACCT-04 — Manual payment recording is not atomic and is race-prone

**Status:** Resolved in the current working tree by migration 106.  
**Original severity:** High reliability risk  
**Resolution:** `record_invoice_payment` locks the invoice, rechecks its confirmed balance, inserts the payment evidence, and updates the received amount, remaining balance, compatibility history, and status in one database transaction. Concurrent overpayment attempts are serialized and rejected.

### ACCT-05 — Monthly expenses can calculate as zero

**Severity:** High defect in a feature labelled “Bientôt”; not counted as a core release blocker while excluded from the supported feature set  
**Evidence:** `src/app/(app)/rapports/page.tsx:69-75,88-98`; `src/app/(app)/transactions/page.tsx:169-181`; `src/app/(app)/transactions/BankImportModal.tsx:446-456`

Current transaction writers store the amount as `Math.abs(...)` and record direction in the transaction `type`. The monthly Reports page instead identifies expenses by `amount < 0`. Current expense records therefore fail the filter. The page also computes monthly turnover from invoices that are currently paid and issued in the selected month, rather than from the applicable accounting/payment-period rule.

**Consumer impact:** Expenses and category totals may display as zero, while net result is materially overstated. Historical monthly turnover can change when an old invoice is paid later.

**Required action before declaring Reports available:** Use a single normalized signed-amount/domain convention everywhere, migrate legacy data, and validate monthly reports against a golden ledger dataset.

### ACCT-06 — Dossier financial statements use conflicting sources and can double-count revenue

**Severity:** Dormant; not a current-user blocker while disabled  
**Evidence:** `src/app/comptable-pro/dossiers/[id]/bilan/page.tsx:20-38`; `src/app/comptable-pro/dossiers/[id]/bilan/BilanClient.tsx:110-151`; `src/components/GrandLivreView.tsx:69-135`; feature gate at `src/lib/features.ts:9`

The dossier financial-statement fallback combines paid invoice totals and income bank transactions. The same sale and its bank receipt can therefore be counted twice, and invoice TTC can be treated as revenue even though it includes VAT. The dossier views read legacy `dossier_ecritures`, while automated accounting booking writes `ecritures_comptables` with a dossier ID.

**Consumer impact:** Revenue, result, ledger, and balance sheet can disagree or be materially overstated.

**Required action:** Do not enable the feature until all statements derive exclusively from the authoritative balanced ledger, with a documented chart-of-accounts mapping and accountant-approved golden examples.

### ACCT-07 — Zero-rate invoices are not automatically classified into VAT turnover boxes

**Status:** Resolved in the current working tree by migration 107 and the invoice/VAT workflow changes.  
**Original severity:** High and release-blocking for customers who issue 0% invoices  

New 0% invoices and customer credit notes now require one explicit treatment before issue: out of scope, exempt without deduction, exempt with deduction/export, or VAT suspension. Their net base is automatically routed to the matching turnover field using the configured cash- or debit-basis timing, and is included in total turnover. Legacy 0% documents without a treatment are reported in a visible “unclassified” amount and prevent VAT declaration validation rather than disappearing silently.

The treatment is persisted on the invoice, shown on the generated PDF, editable from the document detail page while the relevant VAT period is open, and protected by a database trigger once the applicable debit or collection period is locked. Unit tests cover all four classifications, legacy unclassified turnover, discounts, and proportional cash-basis recognition.

### ACCT-08 — Dashboard VAT is not a reliable statutory figure

The dashboard estimate sums invoice tax for invoices with `paid` or `sent` status by invoice issue date (`src/app/(app)/dashboard/page.tsx:78-90,118`). That is not equivalent to either a cash-basis collection calculation or a complete accrual calculation, and it does not use the dedicated VAT engine.

**Required action:** Label it clearly as non-filing information or source it from the same reconciled VAT calculation used by the return workflow.

### TECH-01 — The local test environment did not pass the candidate readiness probe

`npm run test:e2e` did not start tests because Playwright’s local web server never became healthy within 120 seconds. The candidate health endpoint checks database connectivity and the current schema version (`src/app/api/health/route.ts:5-30`), so the configured environment did not demonstrate candidate database readiness. The exact database-side cause was not isolated. This is a release-confidence gap, not proof of a defect in a normal signed-in workflow.

**Required action:** Provision a clean staging database through the latest ordered migration, validate the health response, and run the full suite against that exact release candidate.

### TECH-02 — Production and the reviewed candidate are different releases

Production reports `b1a122b1cc86`; the local committed candidate is `5831da76bb42` plus many uncommitted changes. Production exposes the older shallow health response and does not report database/schema checks. The parity script intentionally refuses a dirty tree.

**Required action:** Create a clean, committed, reproducible release candidate, deploy it to staging, run database migrations, then test that exact artifact before production promotion.

### TECH-03 — Production smoke suite is red

Against `https://app.mohasibai.com`, 8 of 10 Playwright checks passed. Both desktop and mobile “Solutions navigation” checks timed out. Captures show `/` on the login screen, with no public navigation/menu expected by the test. This may be an intentional routing change, but shipped behavior and its release test are inconsistent.

**Required action:** Decide whether `/` is public marketing or authenticated login, then align routing and the smoke contract. The release suite must be green.

## Verification results

| Check | Result | Notes |
|---|---:|---|
| Migration order validation | Pass | 105 ordered migration files; latest schema version 107 |
| TypeScript | Pass | No compile errors |
| ESLint | Pass with warnings | 0 errors, 81 warnings; includes hook dependencies and render-time mutation warnings |
| Unit/component tests | Pass | 36 files, 198 tests |
| Targeted accounting/VAT retest | Pass | Payment-client, cash-basis VAT, all 0% treatment buckets, legacy-unclassified handling, and proportional collection tests pass |
| Production build | Pass | Next.js build completed; 135 pages/routes generated |
| Diff whitespace validation | Pass | `git diff --check` clean |
| Local end-to-end | Fail to start | Health/readiness did not become healthy within 120 seconds |
| Production public smoke | Fail | 8 passed, 2 failed on desktop/mobile public navigation |
| Dependency vulnerability audit | Not reverified | Registry access would disclose the dependency inventory and was not authorized in this review |
| Authenticated accounting E2E | Not present | No automated consumer journey through invoice → journal → payment → VAT → reports |
| Database/RLS integration tests | Not demonstrated | Unit tests do not validate the deployed migration/RLS behavior |

## Positive controls observed

- The candidate compiles and all 198 current automated tests pass.
- Initial accounting booking has gained an idempotent booking-batch control and balanced-entry validation.
- Bank and purchase booking paths include period-lock checks.
- VAT tests cover discounts, mixed rates, payment allocation, and stamp-duty behavior.
- Payroll calculations now use year-specific settings and have dedicated tests.
- The 2026 Moroccan family-income-tax deduction in code (600 MAD per dependent, maximum 3,600 MAD) agrees with the official 2026 General Tax Code and Ministry of Finance summary.
- Production returns strong baseline response headers, including HSTS, CSP, frame protection, MIME sniffing protection, referrer policy, and permissions policy.
- No obvious tracked production secret file was found in the repository scan; only the environment example file is tracked.

These positives show that much of the calculation and booking foundation is working. The release decision is limited to the specific ordinary workflows confirmed above.

## Test coverage needed before a consumer launch

The existing Playwright suite is one anonymous/public smoke specification (five scenarios across desktop and mobile). It does not cover authenticated daily work. Before release, add database-backed, deterministic tests for at least:

1. New company onboarding and chart-of-accounts setup.
2. Draft invoice, finalization, edit restrictions, credit note, deletion/reversal, and duplicate request replay.
3. Partial, full, bulk, concurrent, excess, reversed, and deleted payments.
4. Invoice → balanced journal → general ledger → trial balance reconciliation.
5. Cash- and accrual-basis VAT across mixed rates, discounts, 0% classifications, credit notes, late payments, and cash stamp duty.
6. Bank import, duplicate detection, classification, reconciliation, and expense reporting.
7. Closed-period enforcement for every mutation route.
8. Tenant isolation and role/RLS tests using two companies and accounting-firm dossiers.
9. Payroll calculation, posting, liabilities, remittance, correction, and year transition.
10. Export accuracy, backup restoration, migration from a clean database, and failure recovery.

Every golden accounting scenario should reconcile to zero difference and be signed off by a qualified Moroccan accountant before public release.

## Minimum go-live gate

1. Apply migrations 105, 106, and 107 before deploying the invoice/accounting/VAT lifecycle code.
2. Add authenticated regression journeys covering those exact behaviors against a migrated staging database.
3. Keep manual entry, Dossier Bilan/CPC, and the inaccurate monthly Reports view disabled or clearly outside the supported product until corrected.
4. Run the clean committed release candidate through staging health, RLS/integration checks, the full smoke suite, and accountant-approved reconciliation examples.

## Scope and assurance limits

This was an engineering and accounting-logic review followed by targeted working-tree fixes. It covered the current source, migrations, automated tests, local verification, and anonymous production smoke behavior. It was not a penetration test, legal review, audit opinion, or certification of Moroccan tax/accounting compliance. Public legal placeholders were intentionally excluded. Production data, authenticated production workflows, external email/OCR/payment integrations, backup restoration, load behavior, and mobile assistive-technology use were not tested.

No software review can certify the absence of every defect. The defensible outcome is narrower than the original wording: **ACCT-02, ACCT-03, ACCT-04, and ACCT-07 are fixed in the working tree; public release still requires migration deployment and authenticated staging reconciliation of the exact candidate.**

## Official statutory references checked

- Morocco Ministry of Economy and Finance, *Code général des impôts 2026*: https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf
- Morocco Ministry of Economy and Finance, *Synthèse de la Loi de Finances 2026*: https://www.finances.gov.ma/Maliya%20tawassol/SLF2026-Fr.pdf
