# Mohasib overall app readiness audit

Date: 2026-09-11  
Scope: current local working tree, automated checks, accounting-critical source paths, and read-only production health/public smoke checks  
Excluded: public legal copy and legal placeholders, at the owner's request  
Decision: **NO-GO for public daily accounting use today**

## Executive conclusion

Mohasib is not ready to be presented to consumers as a daily-use accounting application without technical or accounting issues.

The current working tree is materially healthier than the deployed application: migration ordering, TypeScript, unit tests, the production build, and the production dependency audit all pass. The recent payroll, VAT, invoice lifecycle, payment atomicity, and booking changes have meaningful unit coverage.

The release still fails the practical assurance bar for three independent reasons:

1. Production is running commit `b1a122b1cc86`, the same revision previously shown to contain material payroll, VAT, stamp-duty, and accounting-booking defects. The fixes are only in a local, uncommitted 85-path working tree based on `5831da76bb42`.
2. The corrected candidate has not passed a migrated-database or authenticated end-to-end test. Its local health endpoint returns HTTP 503 with `database=unavailable` and `schema=unavailable`, while expecting schema 107.
3. The directly reachable monthly Reports calculations still contain known misleading accounting totals. The dashboard VAT finding identified during this audit was corrected in the working tree after the initial review.

No engineering review can guarantee literally zero defects. A responsible launch standard is that all material accounting invariants and representative daily workflows pass against the exact staged artifact and schema, with accountant-approved expected results. That standard has not been met.

## Release-blocking findings

### P0 — The accounting fixes are not deployed

Production `/api/health` returned HTTP 200 and version `b1a122b1cc86`. Its health response checks only application/configuration and exposes no database or schema result. The local candidate expects schema 107 and includes migrations 097–107 as untracked files.

The prior audit of `b1a122b1cc86` reproduced material defects in:

- effective payroll rules and payroll-variable inclusion;
- discounted/mixed-rate VAT calculation and unsupported input-VAT inference;
- cash receipt stamp duty;
- transactional/idempotent accounting booking.

Those fixes cannot protect production until migrations and application code are deployed together and the exact resulting artifact is retested.

### Resolved in working tree — Dashboard VAT summary

Evidence: `src/app/(app)/dashboard/page.tsx:93-94`, `:118`, and `:245-251`.

The original dashboard selected invoice `tax_amount` for invoices whose current status was `paid` or `sent`, filtered by invoice issue date, and summed output VAT only.

The working tree now reads the authoritative saved declaration for the current statutory month or quarter. The card shows `À préparer`, `Brouillon`, `Validée`, or `Déposée`, displays saved VAT due or VAT credit, and links to the matching period in the VAT section. Focused lifecycle/period tests, TypeScript, and lint pass. This remains undeployed and is therefore still part of the production release gap.

Required action: include this remediation in the clean candidate and verify it against the migrated staging database.

### P1 — The monthly Reports page is linked and produces incorrect totals

Evidence: `src/components/AppShell.tsx:60`, `:473-489`; `src/app/(app)/rapports/page.tsx:69-98`; `src/app/(app)/transactions/page.tsx:171-176`; `src/app/(app)/transactions/BankImportModal.tsx:446-459`.

The navigation labels Reports "Bientôt" but still links to the live route. The report finds expenses using `amount < 0`, while current transaction writers store `Math.abs(amount)` and preserve direction in `type`. As a result, normal expenses can display as zero. Monthly turnover is also based on invoices that are currently `paid` and issued in the selected month, rather than the applicable accounting/tax recognition event.

Impact: expenses, category totals, turnover, and net result can be materially wrong.

Required action: hide/block the route until fixed, or derive it from the authoritative ledger and shared recognition rules with golden tests.

### P1 — The candidate has no database-backed authenticated release proof

The local browser suite could not become ready because `/api/health` returned HTTP 503:

```json
{
  "status": "degraded",
  "checks": {
    "application": "ok",
    "configuration": "ok",
    "database": "unavailable",
    "schema": "unavailable"
  },
  "schemaVersion": null,
  "expectedSchemaVersion": 107
}
```

The repository contains 110 API route handlers but only two route-handler test files. Its one Playwright specification contains ten anonymous/public checks and does not exercise signup, tenant isolation, invoice finalization, journal booking, payment, VAT, payroll, bank import, reconciliation, exports, period locks, or roles/RLS.

Required action: test the exact clean candidate against a disposable/staging Supabase database migrated through 107, with two-tenant RLS tests and accountant-approved authenticated golden journeys.

### P1 — The release candidate is not reproducible

The working tree has 85 changed paths: 50 modified tracked paths and 35 untracked paths. This includes the core remediations, tests, API handlers, and migrations 097–107. `HEAD` is `5831da76bb42`; production/origin is `b1a122b1cc86`.

Impact: there is no immutable commit that can be built, reviewed, deployed, rolled back, or compared with production. The production parity check is expected to fail closed on this state.

Required action: review and commit the intended candidate, run all release checks from a clean checkout, and deploy that exact SHA.

## Non-blocking but important risks

- ESLint passes with 81 warnings, including stale hook dependencies, synchronous effect state updates, components created during render, and render-time mutation in accounting-facing screens. These are not proof of wrong balances, but they raise UI reliability risk.
- The live public smoke suite passes 8/10. Desktop and mobile Solutions navigation fail because `/` redirects to `/connexion`, while the test expects the marketing navbar. Product routing and the release contract disagree.
- Dormant manual-entry APIs can mutate individual journal lines without whole-entry balancing if `NEXT_PUBLIC_SAISIE_ENABLED=true`. Keep manual entry disabled until mutations are transactional, balanced, scoped, and period-locked.
- Production health is shallow and cannot prove database connectivity, migration parity, storage, email/PDF/OCR integrations, scheduled jobs, backup readiness, or restoration.
- Backup restore, load/concurrency behavior, external provider failures, and production monitoring were not demonstrated.

## Verification evidence

| Check | Result | Evidence |
|---|---:|---|
| Ordered migrations | Pass | 105 ordered files; latest expected schema 107 |
| TypeScript | Pass | `npm run typecheck` |
| ESLint | Pass with warnings | 0 errors, 81 warnings |
| Unit tests | Pass | 36 files, 198 tests |
| Production build | Pass | Next.js 16.3.3; 135 generated routes/pages |
| Diff whitespace | Pass | `git diff --check` |
| Production dependency audit | Pass | 0 known vulnerabilities |
| Tracked secret heuristic | Pass | only `.env.local.example` placeholder detected |
| Local Playwright | Blocked/fail | candidate health HTTP 503; DB/schema unavailable |
| Production Playwright | Fail | 8 passed, 2 failed on homepage navigation contract |
| Production health | Partial pass | HTTP 200, security headers present, old version, shallow checks |
| Authenticated accounting E2E | Missing | no automated daily consumer journey |
| Database migration/RLS integration | Not demonstrated | no clean/staging schema 107 result |
| Production parity | Fail by state | deployed version differs; local tree dirty |

## Positive controls

- Build, type checking, migration ordering, unit testing, and dependency auditing are automated.
- The current unit suite covers effective-dated 2025/2026 payroll, payroll variables and exceptions, discounted/mixed-rate VAT, zero-rate classifications, cash receipt stamp duty, invoice/payment lifecycles, transaction review, treasury, and accounting booking.
- The current design uses database functions for atomic invoice finalization, payment recording, and accounting booking, with row locking and source-level idempotency controls.
- The candidate health endpoint fails closed on missing database connectivity or schema mismatch.
- Production sends HSTS, CSP, frame, MIME-sniffing, referrer-policy, and permissions-policy headers.
- No obvious tracked production secret was found.

## Minimum go-live gate

1. Hide or fix the monthly Reports route and retain the corrected declaration-backed dashboard VAT card.
2. Create one clean, reviewed release commit containing the intended code and migrations 097–107.
3. Apply all migrations to a disposable/staging database and require health to report `database=ok`, `schema=ok`, and `schemaVersion=107`.
4. Add authenticated golden tests for onboarding, invoice finalization, balanced booking, partial/full/concurrent payment, cash/debit VAT, credit notes, payroll, CNSS/remittances, bank import, transaction review, period locks, exports, and two-tenant RLS isolation.
5. Have a qualified Moroccan accountant/payroll professional approve representative expected journals, VAT results, payslips, CNSS outputs, and rounding.
6. Run `npm run verify`, `npm run test:e2e`, `npm audit --omit=dev --audit-level=high`, database security checks, and production parity from a clean checkout.
7. Deploy migrations before/with the exact application SHA, rerun authenticated production smoke tests, and monitor errors/database/jobs for at least 30 minutes.
8. Verify a recent backup and perform a restoration rehearsal before inviting consumers.

## Recommended launch decision

**Do not open the current production application for daily consumer accounting use.**

The working-tree remediations are a strong pre-release candidate, but they should remain in controlled staging until the remaining exposed Reports calculations are corrected or hidden, schema 107 is proven, authenticated/RLS golden journeys pass, and a clean exact SHA is deployed. Public legal placeholders were not assessed and do not affect this decision.

## Assurance limits

This is an engineering and accounting-logic readiness review, not a statutory audit, penetration test, or guarantee of defect-free software. It did not access production customer data, credentials, logs, backups, Supabase policies/schema, email inboxes, OCR providers, or filing portals. Final Moroccan accounting/tax/payroll sign-off belongs to a qualified professional using representative datasets.
