# Client certificate lookup

Apply the client_certificates migration before deploying lookup-client-certificate. The function validates the signed-in user, P2G MFA, active organization membership, and restricts lookup to P2G. Each result belongs to the user and organization that started it. Database reservations limit paid starts to one per organization per 30 seconds and 100 per rolling day.

Required Supabase server secret: APIFY_API_TOKEN (existing prospect integration secret). Optional APIFY_CERTIFICATE_TASK_ID defaults to ScJCNev9cjvPW5dU7. Never use a VITE_ variable for either secret. Standard SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are supplied by Supabase.

The saved Apify task must already contain its URL, cookies and pageFunction. Start sends only {customData:{crcCode}} as task input override. API timeout is 180 seconds and memory inherits the saved task configuration (validated task: 2048 MB); HTTP start is never retried to avoid duplicate charges. The task must output one dataset item with nipc, denominacao, cae [{codigo,descricao,principal}], gerentes [{nome,nif}], ok, erro. No cookies, task input, raw provider error or API token is returned to clients.

Requests: POST {action:"start",organizationId,crcCode} returns {runId,status:"RUNNING"}; POST {action:"status",organizationId,runId} returns RUNNING, SUCCEEDED with data, or FAILED. Poll at most every 2.5 seconds; stop after five minutes. Client persistence uses crc_code, certificate_data, certificate_checked_at.

Deployment was verified on 23 October 2026 through GitHub Actions run 39927709548, using the existing repository SUPABASE_ACCESS_TOKEN secret. The CRC migration was applied and lookup-client-certificate deployed from codex/client-certificate-integration, commit 38e4c279cf0bad5e86b79086b930c36f181f713f. OPTIONS from localhost:8080 returned 200 after deployment (previously 404 NOT_FOUND). Real lookups through both local create-client and edit-client forms returned the expected company, NIPC, three CAEs and two current managers. Edit test changes were canceled without modifying the existing client. Final build and 16 integration tests passed; migration test passed. Changing CRC after applying a certificate clears only its unchanged auto-filled identity fields and removes the certificate payload; manually edited identity values are preserved. Fresh narrow-screen create/edit captures are in agent_docs/crc-qa/.

## Resumable import update

Apply 20261023090848_resumable_client_certificates after the initial migration before deploying the updated function (including lookup.ts). scripts/deploy-client-certificate.mjs applies both in order and skips recorded versions. Published and remotely verified on 23 October 2026 through GitHub Actions run 39930445158, commit 4fb885cad10ce1ab78e4bba002a04e79479d231a. The ordered deployment applied the resumable migration and deployed the updated Edge Function.

Start accepts an optional requestId UUID. Clients should persist this UUID with organizationId, CRC and the returned runId before leaving the form. Repeating it returns the original reservation even if the first acknowledgement was lost. Reusing a requestId with another CRC is rejected. Legacy callers without requestId remain supported; active-run reuse still prevents a second paid launch while a matching run is pending.

The server reserves the job durably before scheduling the provider start through EdgeRuntime.waitUntil. All responses include runId, status, phase (QUEUED or EXTRACTING), and startedAt. A pending reservation may briefly lack a provider identifier and remains RUNNING. Reservations older than five minutes become FAILED when polled. An ambiguous or failed provider start becomes FAILED without an automatic paid retry. A deliberate new user request may initiate a new reservation after the cooldown.

The same user and organization can reuse an active matching CRC or a successful certificate checked within ten minutes. Success responses include data, checkedAt and cached. Request aliases refer to the original lookup row, preserving its completion timestamp and preventing the cache lifetime from extending on reuse. The org cooldown and daily limit count provider-launch reservations, not request aliases or cache hits. Results stay restricted to the original user and organization.

Local checks: bun test ./supabase/functions/lookup-client-certificate; node supabase/functions/lookup-client-certificate/migration.test.mjs. These use mocked HTTP and an in-memory Postgres-compatible database, with no paid Apify requests.


## Resilience validation (23 October 2026)

A real local-browser lookup continued after closing the create form and reloading the page. Reopening recovered the CRC, unsaved notes, and the complete official result. Apify run 3SQeiVKNJh0pOqD5f succeeded in 50 seconds; task run count increased from 28 to 29 only. Repeated same-CRC lookup completed in 0.762 seconds with the original completion timestamp retained. Edit-form draft and imported result survived reload; explicit discard restored the existing client. No CRM client was created or modified during these tests.

Current verification: 26 frontend/persistence/draft/decision-maker tests and 10 provider/lookup tests passed; migration concurrency, lost-acknowledgement, cache timestamp and user-isolation checks passed. Production build and targeted ESLint passed. Project-wide TypeScript still reports pre-existing errors outside the certificate integration; no diagnostics remain in the changed certificate/form files.

Drafts are stored for 24 hours in the same browser, scoped by user, organization, and create/edit client. Clearing browser data or switching device does not preserve an unsaved draft. Successful client save or explicit discard clears recovery. The progress indicator is indeterminate and reports real server phase and elapsed time, without a fabricated percentage.

A second intentional lookup after the 10-minute cache window completed while the create form stayed closed. Reopening automatically applied the newer provider completion timestamp. The six final captures passed both independent visual integrity and layout reviews; reports: .omo/evidence/resilient-visual-functional.md and resilient-visual-layout.md.
