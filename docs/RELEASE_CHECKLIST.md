# Mohasib release checklist

Use this checklist for every production release.

## Before deployment

- [ ] Legal pages contain no placeholders and have been approved.
- [ ] `npm run verify` passes from a clean checkout.
- [ ] `npm run test:e2e` passes against the release build.
- [ ] CI is green for the exact commit being deployed.
- [ ] `npm audit --omit=dev --audit-level=high` passes.
- [ ] Migration history passes `npm run migrations:check`.
- [ ] New migrations were tested on a staging database and have a rollback or forward-fix plan.
- [ ] Production environment variables match `.env.local.example`.
- [ ] Supabase point-in-time recovery or a recent verified backup is available.
- [ ] Vercel and Supabase dashboards are open for deployment monitoring.

## Smoke test after deployment

- [ ] `/api/health` returns HTTP 200 with `status: "ok"`.
- [ ] Homepage, pricing, signup, login, password recovery, CGU, and privacy pages load.
- [ ] A test user can sign in and sign out.
- [ ] Create a client and invoice, then download its PDF.
- [ ] Send an invoice email to a controlled test inbox.
- [ ] Import one known bank statement and verify its totals.
- [ ] Upload one known OCR fixture and verify extracted totals and TVA.
- [ ] Export accounting data and open the generated file.
- [ ] Confirm tenant isolation with two test accounts.
- [ ] Confirm admin routes are inaccessible to a normal account.

## Monitor for 30 minutes

- [ ] No increase in HTTP 5xx responses or function failures.
- [ ] Authentication failures and rate-limit events remain within expected levels.
- [ ] Cron executions succeed.
- [ ] Database CPU, connections, storage, and slow queries are nominal.
- [ ] PDF, email, OCR, and OAuth integrations have no new errors.

## Rollback triggers

Rollback or disable the affected feature when any of these occurs:

- A user can access another tenant's financial or payroll data.
- Authentication, invoice creation, PDF generation, or exports fail consistently.
- HTTP 5xx exceeds 2% for five minutes.
- Database errors or latency remain elevated for ten minutes.
- A migration causes data loss, incorrect balances, or blocked writes.

## Rollback procedure

1. Stop further deployments and record the failing commit SHA.
2. Roll Vercel back to the previous healthy deployment.
3. Disable affected cron jobs or integrations if they are amplifying the issue.
4. Prefer a forward-fix migration. Restore data only from a verified backup and only after impact review.
5. Re-run the smoke test and document the incident, impact, and corrective action.
