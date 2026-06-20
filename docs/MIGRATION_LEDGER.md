# Mohasib Migration Ledger

Last reviewed: 2026-06-18

Supabase project reference: `keukfqryqsubbjvzvtqs`

## Production Baseline

The application history indicates that migrations `001` through `053` were created for the
production schema, with several later repair migrations applied manually through the Supabase
SQL Editor. This is the repository baseline, not yet a remote-ledger verification.

Remote verification remains required against:

```sql
select version, name, statements
from supabase_migrations.schema_migrations
order by version;
```

Do not mark the baseline as remotely verified until the result has been compared with this
repository.

## Duplicate 026 Resolution

Two files previously used version `026`:

- `026_company_documents_dossier_id.sql`
- `026_inbox_email_backfill.sql`

The company-document migration keeps version `026`. Production originally recorded the inbox
backfill as version `0261`. Because short Supabase versions sort `0261` before `026`, the remote
ledger was repaired to mark `0261` reverted and `054` applied. The local file is
`054_inbox_email_backfill.sql`. Its SQL body was not changed and the repair did not execute SQL.

The backfill is idempotent because it only updates dossiers where `inbox_email` is still `NULL`.

Original SHA-256:

```text
8d7404b4c7c778bc9ee54748dcff460f0cf26796c430e3d4f50ac240e03f0378
```

## Legacy SQL

`create_companies_and_prefs.sql` is an unversioned legacy bootstrap script. Supabase CLI does
not include it in ordered migrations. Do not run it automatically against production. Its
objects must be reconciled with the numbered migrations before it is retired or converted.

## Verification Procedure

1. Run `npm run migrations:check`.
2. Install and start Docker Desktop.
3. Run `npx supabase start`.
4. Run `npx supabase db reset`.
5. Run `npx supabase db lint --level warning`.
6. Run `supabase/tests/security_advisor.sql` and require every result set to be empty.
7. Link production with `npx supabase link --project-ref keukfqryqsubbjvzvtqs`.
8. Compare `npx supabase migration list --linked` with this ledger.
9. Run `npx supabase inspect db table-sizes --linked` and the Security Advisor in Dashboard.
10. Apply `npx supabase db push --dry-run` before any production migration push.

## Current Verification Status

- Ordered migration filenames and SHA-256 hashes: verified on 2026-06-18.
- Duplicate migration versions: none.
- `054` SQL body matches the former second `026`: verified.
- Remote migration ledger: verified through `034` on 2026-06-18.
- Production originally recorded the historical second `026` as `0261`; ledger-only repair maps
  it to `054`.
- Local migrations `035` through `053` are not present in the remote migration ledger.
- Do not push or repair `035` through `053` until their schema effects are compared with production.
- Fresh `supabase db reset`: blocked because Docker Desktop is not installed/running.
- `supabase db lint`: blocked because no local Postgres instance is running.
- Production credentials were provided for this verification session. Rotate them after use.

## Production Security Advisor

Verified through the Supabase Management API on 2026-06-18.

No `rls_disabled_in_public` errors were reported.

Open findings:

- 7 informational `rls_enabled_no_policy` findings:
  `employee_documents`, `employee_heures`, `employee_leave_balance`, `employee_primes`,
  `leave_types`, `ocr_corrections`, and `rate_limits`.
- 2 `function_search_path_mutable` warnings:
  `prevent_audit_logs_mutation` and `prevent_accounting_events_mutation`.
- 2 unrestricted insert-policy warnings:
  `accounting_events.Insert events` and `audit_logs.System can insert logs`.
- 14 security-definer functions executable by `anon`.
- The same 14 security-definer functions executable by `authenticated`.
- Supabase Auth leaked-password protection is disabled.

Production `db lint` also reported shadowed/unused loop variables in
`ensure_holidays_populated` and `populate_islamic_holidays`.

Index statistics were inspected successfully. Several indexes currently report zero scans, but
the database is small and these include constraints and recently added audit/accounting indexes.
Do not remove them based on this single snapshot.

Never use `migration repair` until the remote ledger and the actual production schema have
both been inspected.
