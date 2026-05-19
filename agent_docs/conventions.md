# Project Conventions

## How to use this file

When something works perfectly, add it here immediately.
When something fails and gets corrected, add the rule here to never repeat it.
This file grows with the project and is the most important memory we have.

---

## Database

### Naming
- Table for clients is `crm_clients` (not `clients`). Always use the full name.
- CPE table is `cpes`. The `client_id` FK links to `crm_clients.id`.
- Column `conselho` stores the concelho value (historical naming — do not rename, but UI must show "Concelho").
- NIF is stored normalized (digits only, no dots/dashes). Normalize with `.replace(/[.\-\s]/g, "")` before queries.

### Triggers
- `trg_update_client_total_mwh` — Auto-recalculates `crm_clients.total_mwh` from `SUM(cpes.consumo_anual) / 1000` on CPE insert/update/delete.
- `trigger_update_client_proposal_metrics` — Updates `total_proposals`, `total_value`, `total_comissao` on proposal changes.
- `trigger_update_client_sales_metrics` — Updates `total_sales` on sale changes.
- Auto-code triggers (`trigger_set_client_code`, `trigger_set_proposal_code`, `trigger_set_sale_code`) generate sequential codes per organization.

### Deduplication
- Client import deduplicates by NIF first, then by company name (case-insensitive via `ilike`).
- Prospect dedup uses normalized NIF and stripped email domains.

### Migrations
- File naming: `YYYYMMDDHHMMSS_description.sql`
- Always use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency.
- Run via Supabase SQL Editor (CLI deploy not configured).

---

## Frontend

### Component patterns
- Pages are default-exported: `export default function PageName()`.
- Components use named exports: `export function ComponentName()`.
- Hooks follow `use*` naming and return TanStack Query objects (`useQuery`, `useMutation`).
- Query keys are arrays: `['entity-name', organizationId, ...filters]`.

### State management
- Server state: TanStack React Query (never store fetched data in React state).
- Persisted UI state: `usePersistedState(key, defaultValue)` — stores in localStorage.
- **When changing persisted state shape, bump the key version** (e.g., `v1` → `v2`) to avoid deserialization issues.
- Global client state: Zustand stores (only for `dashboardPeriod` and `ottoChat`).

### Forms
- Required fields show `*` after the label.
- Email and phone are always required on client forms (hardcoded in `isValid`, not dependent on field settings).
- Distrito and Concelho are always required on client forms.
- Use `PhoneInput` component for phone fields (international format).

### Styling
- Tailwind utility classes only — no CSS modules or styled-components.
- Dark mode via `class` strategy (next-themes).
- Colors use HSL CSS variables defined in `index.css`.
- Responsive: mobile-first with `sm:`, `md:`, `lg:` breakpoints. Extra `xs: 475px` breakpoint available.

### Encoding
- All source files must be UTF-8.
- Portuguese characters (`ã`, `ç`, `é`, etc.) must render correctly.
- If garbled text appears (e.g., `ComissÃ£o` instead of `Comissão`), the file was saved with wrong encoding — re-save as UTF-8.

### P2G-specific conditionals
- `isPerfect2GetherOrg(organizationId)` — Checks if current org is P2G by ID.
- `hasPerfect2GetherAccess({...})` — Checks membership + active status.
- `organization?.niche === 'telecom'` — P2G inherits telecom niche from SENVIA.
- `modules.energy` — Energy module flag, used with `showEnergy = isTelecom && modules.energy`.

---

## API & Edge Functions

### Supabase client
- Import from `@/integrations/supabase/client` (singleton instance).
- Always filter by `organization_id` in queries.
- Use `.maybeSingle()` for lookups that may return 0 or 1 row (avoids error on 0 rows).

### Edge Functions
- Runtime: Deno (TypeScript).
- Located in `supabase/functions/<function-name>/index.ts`.
- Use `supabaseAdmin` client (service role) for operations that bypass RLS.
- CORS headers are required for browser-invoked functions.

### Team member management
- `create-team-member` function: Creates auth user + profile + org membership + user_role.
- Role update: Delete existing roles first, then insert new one (not upsert — avoids stale roles).
- Never delete `super_admin` role when updating: `.delete().eq('user_id', userId).neq('role', 'super_admin')`.

---

## Deploy & Environment

### Vercel
- Deploy command: `npx vercel --prod`
- Always run `npx tsc --noEmit` before deploy to catch type errors.
- SPA routing: `vercel.json` rewrites all paths to `/index.html`.
- Only 2 env vars needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Supabase
- DDL changes: Run in Supabase SQL Editor manually.
- Edge Function deploy: `npx supabase functions deploy <name>` (requires login).
- Service role key is in `.env` (never commit — `.gitignore` excludes `.env`).

---

## GitHub & Version Control

### Commits
- Convention: `feat:`, `fix:`, `chore:` prefix.
- Messages in Portuguese.
- When Claude creates commits, add: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.

### Branch strategy
- Single branch: `master`.
- No feature branches, PRs, or staging environment.
- Push directly to `master` — Vercel auto-deploys.

---

## Errors Already Fixed

| Date | Error | Fix |
|------|-------|-----|
| 2026-05-15 | `relation 'clients' does not exist` in trigger SQL | Table is `crm_clients`, not `clients`. Always use full table name. |
| 2026-05-15 | `user_roles` empty for admin user — shows as "Colaborador" | Role record was missing. Insert role directly; use delete+insert (not upsert) for role changes. |
| 2026-05-15 | Garbled text `ComissÃ£o`, `Â·` in UI | Source file had wrong encoding. Re-saved as UTF-8. |
| 2026-05-15 | kWp always 0.0 for P2G clients | kWp is a solar metric, not relevant for energy brokerage. Hidden for P2G org with `!isP2G` conditional. |
| 2026-05-15 | Collaborator filter in Clients page not working | Old localStorage state had `source` field but not `assignedTo`. Bumped localStorage key from `v1` to `v2` to force reset. |
| 2026-05-15 | `create-team-member` upsert not replacing roles | `onConflict: 'user_id,role'` didn't replace existing roles. Changed to delete+insert pattern. |
