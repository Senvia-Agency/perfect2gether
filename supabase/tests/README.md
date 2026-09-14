# Monthly commitment RLS regression

Run in this directory:

```sh
npm ci --ignore-scripts
npm test
```

The harness runs PostgreSQL through PGlite with synthetic data in memory. It loads
the original commitment migrations and the actual `has_role`, `get_user_org_id`,
`is_org_member`, and `has_module_permission` definitions from this repository.
Surrounding tables and the Supabase authentication context use minimal fixtures.
It never reads `.env` or connects to a remote database.

To reproduce the pre-fix behavior (expected nonzero exit):

```sh
P2G_RLS_BASELINE=1 npm test
```

Baseline INSERT and UPSERT fail with SQLSTATE `42501` and the policy name
`perm_write_ins_monthly_commitments`; UPDATE and DELETE affect zero rows.
After the fix, 16 scenarios pass (17 tests including the parent test).

Coverage includes own INSERT/UPDATE/UPSERT/DELETE, denial for other users and
organizations, ownership transfer, inactive membership, anonymous access,
preservation of admin and super-admin behavior, and repeatable migration execution.

## Production application

The change is `../migrations/20260914180000_allow_own_monthly_commitments.sql`.
Apply it using the Supabase SQL Editor or an authenticated database migration
connection. The Data API `service_role` key cannot execute this DDL through the
project's currently exposed RPCs. No frontend deployment is required.

Before applying, inspect `pg_policies` for `public.monthly_commitments` and the
deployed `is_org_member` definition. The three `perm_write_*_monthly_commitments`
policies must exist and be RESTRICTIVE. `is_org_member` must enforce active
membership. Existing permissive ownership/organization policies remain in place.

After applying, re-read the policies and test saving the affected user's own
commitment through the application. Local SQL regression results alone do not
confirm production deployment or browser behavior.

## Production verification — 2026-09-14 09:58 UTC

- Applied the migration through the Supabase Management API after inspecting the
  deployed policies and permission helpers. The latest organization-resolution
  migration (20260309154707) matches production and is loaded by the local harness.
- Before application, an authenticated SQL test using the affected commercial
  account reproduced the exact restrictive-policy denial. The test rolled back.
- After application, a second transaction verified own INSERT, UPDATE, UPSERT,
  SELECT/read-back and DELETE with management permission still false.
- Other-user INSERT, UPDATE and DELETE remained blocked, as did attempts to change
  the row's owner or organization. All test mutations were rolled back.
- A separate read confirmed zero remaining test rows, RLS enabled, the four
  original permissive policies intact, and all three restrictive policies updated.
- These checks exercised production PostgreSQL with `SET LOCAL ROLE authenticated`
  and the affected account's authentication claims. An interactive browser save
  was not performed; no account login or password change was used for testing.

## Security regression suite — 2026-09-14

From the repository root, install the application dependencies plus the test dependencies, then run:

```sh
npm test --prefix supabase/tests
node supabase/tests/security-email-auth.typecheck.mjs
```

The test command now runs all five suites: 184 assertions/scenarios including parent tests. The compiler command checks all five changed handlers and both shared helpers against the installed SDK. It supplies minimal Deno globals; deployment remains a separate check. Handler tests execute the actual TypeScript with mocked authentication, database and provider boundaries; they never send emails or alter real invoices. Database tests load the actual policies and helpers into in-memory PostgreSQL.

For the separate database containment baseline (expected failures):

```sh
P2G_SECURITY_BASELINE=1 node --test supabase/tests/security-database-rls.test.mjs
```

Production deployment, checks, known residuals and rollback are recorded under agent_docs/security/2026-09-14. KeyInvoice cancellation payload checks establish compatibility with existing code, not correctness at the real provider: the synthetic receipt DocNum issue remains outstanding.
