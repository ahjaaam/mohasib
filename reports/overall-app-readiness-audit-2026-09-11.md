# Mohasib overall consumer-readiness audit

Date: 2026-09-11  
Local candidate: post-`d0c9fbc013b5` working tree with transactional money-flow fixes  
Production observed: `d0c9fbc013b5` at `https://app.mohasibai.com` (rechecked after deployment)  
Decision: **NO-GO for public daily accounting use**

## Scope and exclusions

Reviewed the current clean repository, automated release checks, enabled consumer-facing accounting paths, the linked Supabase migration state, and read-only production health/public smoke behavior.

Excluded as requested:

- public legal copy and legal placeholders;
- Treasury and bank reconciliation while their feature flags remain disabled;
- manual journal entry, Grand Livre, and Bilan while their feature flags remain disabled;
- the Reports preview labelled **Bientôt** (its known calculations must not be treated as supported until fixed or genuinely blocked from use).

No review can prove that software has literally zero defects. The practical release standard used here is: no known material accounting-integrity defect, an exact code/schema deployment match, and representative authenticated workflows passing against that exact release.

## Executive conclusion

Mohasib is substantially healthier than in the earlier audits, but it is not ready to be promised as a daily-use consumer accounting app without technical or accounting issues.

The local candidate passes migration ordering, TypeScript, unit tests, production build, local public browser smoke tests, and the production-dependency vulnerability audit. The linked database contains migrations through schema 107; the local fix introduces schema 108. The 2026 IR family reduction encoded locally agrees with the official 2026 tax code and Finance Ministry summary.

The two known money-changing workflow defects are fixed in the local candidate. Release remains blocked until schema 108 and the matching application are deployed together, followed by authenticated workflow proof:

1. Apply migration 108 before or atomically with the matching application deployment; the application health check now requires schema 108.
2. Prove the fixed credit-note and supplier-payment journeys against that deployed schema.
3. There is still no broad authenticated database-backed end-to-end proof for the daily accounting workflows.

## Release-blocking findings

### Resolved after deployment — Production application/database parity

Evidence:

- Audited local commit: `d0c9fbc013b5`.
- Rechecked production `/api/health`: HTTP 200, application version `d0c9fbc013b5`, `database=ok`, `schema=ok`, and `schemaVersion=107`.
- `npx supabase migration list --linked`: remote migrations 001–107 match the local ordered history.

Conclusion: the previously reported mixed-version P0 was accurate at the first observation but is now resolved and removed from the active blocker list.

### Resolved locally — Customer credit-note atomic booking and period locking

Local fix:

- Credit notes are first persisted as drafts. The UI finalizes them through a checked API request and preserves the draft if booking fails.
- The booking route validates credit-note type and lifecycle status and checks the effective accounting-period lock.
- Migration 108 adds `finalize_credit_note_accounting_entries`, which row-locks the credit note, rechecks type, draft status, scope, and period lock, books the balanced journal, and changes status in one transaction.
- A database trigger blocks any draft credit note from becoming issued without its matching booking batch.

Deployment condition: migration 108 and its matching application code must be deployed together before this is considered fixed in production.

### Resolved locally — Supplier payment atomicity and retry safety

Local fix:

- Migration 108 adds `record_supplier_payment`, which row-locks the supplier document, recomputes the confirmed payment sum, prevents overpayment, inserts evidence, and updates the displayed paid balance in one transaction.
- Each submission carries a UUID idempotency key. Exact retries return the original result; reuse with changed payment details is rejected.
- The API and **Suivi des échéances** client now use this transaction instead of separate insert and update operations.

Deployment condition: migration 108 and its matching application code must be deployed together before this is considered fixed in production.

### P1 — No authenticated release proof for daily accounting journeys

The Playwright suite contains five public/anonymous scenarios across desktop and mobile. It does not sign in or test invoice finalization, credit notes, purchases, payments, VAT, payroll, journals, period locks, exports, roles, tenant isolation, or RLS.

This leaves the highest-risk integration behavior unproven even though unit tests are strong. Production customer data, logs/Sentry, backups/restoration, email, PDF service, OCR, OAuth, cron jobs, and load/failure behavior were not available for validation.

Required action: run deterministic golden journeys against a staging database migrated through 108, using at least two tenants and multiple roles, and have a qualified Moroccan accountant/payroll professional approve the expected journals, VAT results, payslips, CNSS/remittances, and rounding.

## Non-blocking risks

- ESLint passes with 82 warnings, including stale hook dependencies, effect-driven state updates, render-created components, and render-time mutation in accounting-facing screens. These are reliability risks, not proof of incorrect balances.
- The production public smoke suite passes 8/10; both failures occur because `/` renders the login page while the current test expects the marketing “Solutions” navigation. Resolve the routing/test contract before calling the release suite green.
- Supabase database lint reports only two warnings: loop variables shadow declarations in holiday-population functions. These are low priority.
- Local environment configuration lacks several optional integration/observability variables from `.env.local.example`; therefore local checks do not validate email, Sentry, OAuth token encryption, or related provider behavior.
- Reports is labelled **Bientôt** but remains a clickable route. Its previously identified incorrect totals are excluded from this verdict only on the assumption that it is not a supported public feature. Prefer a hard feature gate or non-clickable preview label.

## Verification matrix

| Check | Result |
|---|---:|
| Git worktree | Local fixes present after `d0c9fbc013b5`; not yet deployed |
| Ordered migration validation | Pass — 106 ordered files, latest local schema 108 |
| Linked database migration parity | Pass — remote 001–107 present |
| TypeScript | Pass |
| ESLint | Pass with 82 warnings, 0 errors |
| Unit tests | Pass — 39 files, 218 tests |
| Production build | Pass — Next.js 16.3.3, 135 generated pages/routes |
| Local desktop/mobile public E2E | Pass — 10/10 |
| Production desktop/mobile public E2E | Fail — 8/10; homepage routing contract mismatch |
| Production dependency audit | Pass — 0 known vulnerabilities |
| Tracked-source secret heuristic | Pass — example placeholder only |
| Linked database lint | Pass with 2 low-risk warnings |
| Production code parity | Pass — production and audited commit are `d0c9fbc013b5` |
| Production schema-aware health | Pass — database/schema OK, schema 107 |
| Authenticated accounting E2E | **Missing** |
| Backup/restore and integration proof | **Missing** |

## Positive controls

- Invoice finalization, client payment recording, and accounting booking in the current candidate use database functions with row locking/idempotency controls.
- Balanced-entry validation exists in both the TypeScript booking engine and the database booking function.
- Current VAT unit coverage includes discounts, mixed rates, cash/debit tax points, collections, credit notes, zero-rate classifications, and legacy handling.
- Payroll rules are effective-dated for 2025 and 2026 and reject unsupported years.
- Production dependencies currently have no known npm advisory at high or greater severity.
- The linked database is fully migrated and its schema lint has no error-level finding.

## Minimum go-live gate

1. Deploy migration 108 and the matching application code as one compatible release.
2. Run authenticated database-backed golden tests for onboarding, invoice → journal → payment, credit notes, purchases/supplier payments, VAT, payroll/CNSS, exports, period locks, roles, and two-tenant RLS isolation.
4. Keep every excluded feature hard-disabled; make Reports non-clickable or gate it until its ledger-derived calculations are corrected and tested.
5. Have a qualified Moroccan accounting/payroll professional sign off the golden expected results.
6. Require schema-aware health to report application/database parity at schema 108 before exposing the release.
7. Rerun `npm run verify`, `npm run test:e2e`, the dependency audit, database security checks, production parity, and authenticated production smoke tests.
8. Verify monitoring, cron jobs, provider integrations, a recent backup, and a restoration rehearsal; monitor the release for at least 30 minutes.

## Final decision

**Do not open the current production application for daily consumer accounting use yet.**

The deployed candidate has a strong automated foundation and application/database parity is currently healthy at schema 107. The two enabled money-changing workflow defects are corrected locally, but production is not fixed until schema 108 and the matching application are deployed and verified. Public legal placeholders were intentionally excluded and do not affect this decision.

## Statutory references checked

- Morocco Ministry of Economy and Finance, [Code général des impôts 2026](https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf).
- Morocco Ministry of Economy and Finance, [Synthèse de la Loi de Finances 2026](https://www.finances.gov.ma/Maliya%20tawassol/SLF2026-Fr.pdf).

## Assurance limits

This is an engineering and accounting-logic readiness review, not a statutory audit, penetration test, or guarantee of defect-free software. It did not inspect production customer records, production observability, backup contents, provider dashboards, or filing portals. Final Moroccan accounting, tax, and payroll sign-off remains the responsibility of a qualified professional using representative datasets.
