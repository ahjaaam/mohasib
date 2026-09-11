# Seven-blocker remediation report

Date: 2026-09-10

## Outcome

All seven identified blockers now have code-level remediations. The release is not live until migration `104_statutory_accounting_configuration.sql` and the application are deployed together. The production parity command is intentionally fail-closed when the worktree, commit, database, or schema does not match.

## Remediations

1. **Dossier VAT calculation** — removed the independent browser calculation. Both entrepreneur and dossier workspaces now call the authenticated server calculation, which accepts only posted, VAT-eligible expenses with explicit HT/rate/tax values and includes discounts, mixed rates, customer credit notes, supplier credit notes, and annual net turnover corrections.
2. **VAT taxable event** — added an employer/dossier `tva_tax_point` choice. Cash receipt is the default; a debit election must be explicit. Cash-basis VAT is recognized proportionally from confirmed invoice collections and exact mirrored legacy payments are deduplicated.
3. **Historical posted expenses** — migration 102 now preserves VAT eligibility when a recoverable-VAT journal line exists and explicitly rejects posted expenses whose journals contain no VAT line. A database constraint prevents a posted transaction from being frozen in `pending_evidence`.
4. **Accounting exports** — sales journals, purchase journals, general ledger, and trial balance now use booked accounting entries. The VAT report uses the shared statutory VAT calculation instead of assuming a 20% tax rate.
5. **Effective-dated payroll** — 2025 and 2026 have explicit rule sets for IR, family deductions, professional expenses, CNSS, AMO, and TFP. Payroll generation rejects every unsupported year instead of silently applying current rates.
6. **Payroll statutory exceptions** — employer and dossier settings now support the AMO solidarity-only regime and TFP exemption. Server-side single and bulk payroll generation load those settings, and payroll/CNSS labels no longer claim standard rates when an exception applies.
7. **Release parity** — health now verifies database connectivity and schema version 104. `npm run release:parity` requires a clean worktree and verifies that production health, commit, and schema match the local release.

## Verification

- Ordered migration history: pass (through migration 104)
- TypeScript: pass
- ESLint: pass with existing warnings, no errors
- Unit tests: pass — 34 files, 187 tests
- Production build: pass — 135 pages
- New regression coverage: discounted and mixed-rate VAT, partial cash receipts, unconfirmed and duplicate payments, customer credit notes, effective payroll years, unsupported payroll years, AMO solidarity-only, and TFP exemption

## Deployment gate

1. Apply migrations through 104.
2. Deploy the exact reviewed commit.
3. Ensure `/api/health` reports HTTP 200 with `database=ok`, `schema=ok`, and `schemaVersion=104`.
4. Run `npm run release:parity` from a clean checkout of that commit.
5. Run authenticated golden scenarios for invoice → collection → VAT, supplier evidence → posting → deduction, payroll standard, payroll AMO solidarity-only, and TFP-exempt payroll before enabling consumers.
