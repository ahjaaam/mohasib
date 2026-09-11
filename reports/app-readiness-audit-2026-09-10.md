# Mohasib consumer-readiness audit

Date: 2026-09-10  
Scope: local release candidate at `b1a122b1cc86`, public unauthenticated browser flows, and read-only checks of the deployed app  
Verdict: **Not ready for daily consumer accounting use**

## Executive conclusion

The application is technically buildable and its public shell is healthy, but it cannot yet be represented as free of accounting errors. The release candidate contains material payroll and VAT calculation defects, and automatic journal booking is not transactionally idempotent. The dependency audit also reports one critical and three high-severity production advisories.

The deployed app responds successfully and has useful security headers, but it is one commit behind the audited local release candidate. The local-only commit changes 63 files and adds migrations 095 and 096, so passing local checks do not prove that the same behavior or schema is live.

## Release-blocking findings

### P0 — Payroll uses an obsolete IR schedule and family deduction

- `src/lib/payroll.ts:2` explicitly labels the engine as using 2024 rates.
- `src/lib/payroll.ts:60-71` uses the old annual bands of 30,000 / 50,000 / 60,000 / 80,000 / 180,000 MAD.
- `src/lib/payroll.ts:76-81` deducts 360 MAD per dependent.
- The official 2026 CGI uses bands of 40,000 / 60,000 / 80,000 / 100,000 / 180,000 MAD. The 2025 reform also raised the family reduction to 500 MAD per dependent, capped at 3,000 MAD.
- Impact: generated payslips can overstate employee income tax and understate net salary.
- Required action: replace hard-coded rules with effective-dated statutory parameters, add reference examples reviewed by a Moroccan payroll professional, and block generation for periods without an approved rule set.

Primary sources: [Moroccan Code général des impôts 2026](https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf), [Ministry of Finance summary of the 2025 reform](https://www.finances.gov.ma/Maliya%20tawassol/SLF-23%20Fr-2025.pdf).

### P0 — Saved overtime, premiums, allowances, and absences do not affect payslips

- The UI stores overtime and absence amounts in `src/app/(app)/paie/page.tsx:567-586`.
- `calculateSalary` accepts overtime, premiums, and allowances at `src/lib/payroll.ts:8-10`, but only returns those values; all contribution, tax, net-pay, and employer-cost calculations use base `salaire_brut` at `src/lib/payroll.ts:43-95`.
- The single and bulk generation routes pass only base salary, family status, and children at `src/app/api/paie/generate/route.ts:46-50` and `src/app/api/paie/generate-bulk/route.ts:101-105`. They do not load `employee_heures`, `employee_primes`, or unpaid-leave deductions.
- Impact: a user can enter payroll variables, generate a payslip, and receive totals that ignore those entries.
- Required action: build one server-side payroll input aggregation path and test overtime bands, taxable/non-taxable premiums, allowances, unpaid absences, partial employment periods, contribution bases, and rounding.

### P0 — VAT on discounted invoices is overstated

- Invoice creation stores gross item amounts but reduces `tax_amount` after a discount in `src/app/(app)/invoices/new/NewInvoiceForm.tsx:244-249` and `:291-308`.
- The VAT calculation ignores the stored discounted `tax_amount`; it sums gross item amounts and recalculates VAT at `src/app/(app)/tva/actions.ts:157-176` and `:215-220`.
- Example: 1,000 MAD HT at 20% with a 10% discount correctly stores 180 MAD VAT, but the declaration calculation reports 200 MAD.
- Annual turnover at `src/app/(app)/tva/actions.ts:140-148` and `:277-280` likewise sums gross `subtotal`, not the net taxable base.
- Impact: VAT payable and annual turnover can be overstated.
- Required action: define gross and net bases explicitly, aggregate authoritative stored tax amounts by rate, and add regression tests for discounts, mixed rates, credit notes, rounding, and zero-rated lines.

### P0 — Expense rows can create unsupported deductible VAT

- Manual transactions and bank imports store a single generic `amount` without tax details at `src/app/(app)/transactions/AddTransactionModal.tsx:53-73` and `src/app/(app)/transactions/BankImportModal.tsx:446-457`.
- The VAT calculator treats every expense transaction as deductible, defaults missing rates to 20%, treats `amount` as HT, and calculates VAT as `amount * rate` at `src/app/(app)/tva/actions.ts:226-251`.
- Example: a 120 MAD bank debit with no supplier invoice becomes 24 MAD deductible VAT; if 120 is TTC, even a fully eligible 20% invoice contains only 20 MAD VAT. Non-deductible bank charges, payroll, taxes, and undocumented expenses are also assigned VAT.
- Impact: VAT deductions can be materially overstated and unsupported by evidence.
- Required action: never infer recoverable VAT from a bank amount. Require a controlled supplier-document workflow, explicit HT/TVA/TTC fields, eligibility, payment evidence, prorata, and review status before a row enters a declaration.

### P0 — Stamp duty is calculated as a flat 2 MAD per invoice

- `src/app/(app)/tva/actions.ts:267-274` applies `nb_factures * 2` regardless of amount or payment method.
- The tax rule is proportional for qualifying cash receipts, not a flat per-invoice charge. The Ministry's guidance describes a 0.25% duty on receipts and discharges settled in cash.
- Impact: declared duty can be both over- and understated and can be charged on non-cash invoices.
- Required action: calculate only on qualifying cash settlements using the current CGI rule and exemptions; obtain professional sign-off.

Primary source: [Ministry/DGI circular describing the 0.25% cash-receipt rule](https://www.finances.gov.ma/Publication/dgi/2019/notecirculaireversionfinale25-1-2019.pdf).

### P1 — Automatic booking can duplicate a complete journal entry

- Idempotency is implemented as a read-before-write check at `src/lib/accounting-engine.ts:83-89`, followed later by a multi-row insert at `:92-106`.
- `supabase/migrations/016_ecritures_comptables.sql:33-38` creates only a non-unique index on `source_id`.
- Two concurrent requests can both observe no prior booking and both insert the full entry. A retry after an ambiguous client/network failure can do the same.
- Required action: move booking into a database transaction and enforce a unique booking key or source-level booking record. Add a concurrency test.

### P1 — Production dependencies include critical/high advisories

`npm audit --omit=dev` reports 7 advisories: 1 critical, 3 high, and 3 moderate. Affected installed packages include Next.js 16.3.0, sharp 0.35.3, nodemailer 9.0.3, mailparser 3.9.15, fast-uri 3.1.5, fflate 0.8.2, and qs 6.15.2. The audit reports fixes are available through dependency updates.

Required action: update the lockfile, rerun the complete verification gate, and specifically regression-test image processing, inbound email parsing, and URL validation.

## Other readiness gaps

### P1 — The tested release candidate is not the deployed version

- Local HEAD: `b1a122b1cc86`.
- Live `/api/health` version: `62b6fddd3f3e`.
- The difference is one commit covering 63 files, 2,316 insertions, 946 deletions, and migrations 095-096.
- Required action: deploy migrations before application code, deploy the exact verified commit, then rerun live smoke and authenticated workflow tests.

### P2 — Public legal text still contains unresolved placeholders

The live CGU and privacy pages expose unresolved retention, analytics, post-termination access, and jurisdiction placeholders. The same markers remain locally in:

- `src/app/cgu/page.tsx:108` and `:184`
- `src/app/confidentialite/page.tsx:128-130` and `:177`

Required action: obtain legal/privacy-owner decisions and fail production builds when public legal pages contain `[TODO:`.

### P2 — Automated coverage does not exercise daily authenticated workflows

- 138 unit tests pass, but there is no test of `calculateSalary` and no server-action test for the VAT calculation.
- The repository has 106 API route handlers and only 2 route-handler test files.
- The 10 Playwright checks all pass on desktop and mobile Chromium, but cover public pages, health, and anonymous redirects only. They do not create an account, invoice, expense, payment, payslip, VAT declaration, export, restore, or reconciliation.
- No disposable Supabase integration test validates migrations, RLS, transactional behavior, or tenant isolation against a running database.

### P2 — The health endpoint is shallow

The live endpoint returned HTTP 200 and reports configuration present, but `src/app/api/health/route.ts:5-25` checks only whether three environment variables exist. It does not verify database connectivity, storage, email/PDF/OCR providers, migration level, or job health.

### P3 — Correctness-oriented lint debt remains

ESLint passes with 106 warnings. These include missing hook dependencies, state changes inside effects, component creation during render, render-time mutation, and accessibility warnings. Several occur in invoices, payroll, dossier navigation, and the general ledger view.

## Verification evidence

| Check | Result |
|---|---|
| Git worktree before report | Clean |
| Ordered migration history | Pass — 94 migrations |
| TypeScript | Pass |
| ESLint | Pass with 106 warnings |
| Unit tests | Pass — 29 files, 138 tests |
| Production build | Pass — Next.js 16.3.0, 133 static pages |
| Playwright public smoke | Pass — 10/10 desktop/mobile checks |
| Production dependency audit | Fail — 7 advisories (1 critical, 3 high, 3 moderate) |
| Tracked-source secret heuristic | Pass — example placeholders only |
| Live health endpoint | HTTP 200; security headers present |
| Live release parity | Fail — live commit is behind local HEAD |
| Live legal-placeholder check | Fail — TODO placeholders are publicly rendered |

## Positive controls observed

- Type checking, unit tests, build, migration ordering, and public browser smoke tests are automated.
- The deployed app sends CSP, HSTS, frame, MIME-sniffing, referrer, and permissions-policy headers.
- Authentication is checked in sensitive route handlers, and RLS/permission infrastructure is substantial.
- Automatic journal functions reject unbalanced batches before insertion.
- Period locking, audit logging, document isolation, plan enforcement, and account customization have dedicated implementation paths.

## Minimum release gate

1. Correct and professionally validate payroll rules for every supported effective period.
2. Integrate overtime, premiums, allowances, absences, and partial periods into payslip generation.
3. Correct VAT bases, deductions, discounts, credit notes, stamp duty, and mixed-rate handling.
4. Make automatic booking transactionally idempotent.
5. Upgrade vulnerable dependencies and rerun all checks.
6. Add authenticated end-to-end golden scenarios with accountant-approved expected ledgers and declarations.
7. Deploy migrations 095-096 before the exact application commit, then verify production parity.
8. Resolve and approve the public legal text.

## Audit limitation

This is a code, automated-test, and unauthenticated deployment review, not a statutory audit or a guarantee of defect-free operation. It did not use production credentials, inspect live Supabase RLS/migration state, replay real customer ledgers, review Sentry/production logs, test backups/restores, or validate filings with the DGI/CNSS. Final accounting sign-off must come from a qualified Moroccan accountant/payroll professional using representative golden datasets.
