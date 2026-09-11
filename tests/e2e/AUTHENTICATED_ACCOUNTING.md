# Authenticated accounting corpus E2E

These tests use the documents in `Mohasib Demo Samples` without committing customer documents to the repository.

The mutation scenarios refuse to run against the known production Supabase project or a `mohasibai.com` application host. Provide two pre-seeded, approved accounts in a disposable local, test, or preview project:

```sh
MOHASIB_E2E_SAMPLE_ROOT="$HOME/Downloads/Mohasib Demo Samples" \
MOHASIB_E2E_AUTHENTICATED=1 \
MOHASIB_E2E_ENVIRONMENT=test \
PLAYWRIGHT_BASE_URL=https://your-test-app.example \
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
MOHASIB_E2E_USER_EMAIL=... \
MOHASIB_E2E_USER_PASSWORD=... \
MOHASIB_E2E_OTHER_USER_EMAIL=... \
MOHASIB_E2E_OTHER_USER_PASSWORD=... \
npx playwright test tests/e2e/authenticated-accounting-corpus.spec.ts --project=chromium
```

The first two tests inventory all 46 files and can run without backend credentials. The authenticated scenarios cover UI login/upload, OCR assertions for an invoice with explicit printed values, database state, balanced purchase booking, VAT amount, supplier balance, concurrent retry/idempotency, cleanup, and two-way RLS isolation.

Bank reconciliation is deliberately a `todo`: the three statements contain real transactions but the corpus does not provide an accountant-approved matching invoice/payment ledger. Purchase-order booking and ambiguous-VAT behavior are also `todo` requirements rather than invented expectations.
