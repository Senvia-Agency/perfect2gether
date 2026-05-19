# Perfect2Gether (P2G)

## Project Overview

Multi-tenant CRM/SaaS for energy brokers in Portugal. Manages the full sales pipeline: Leads → Prospects → Proposals → Sales → Commissions. Forked from SENVIA (telecom CRM) and rebranded for the energy sector. Organization niche is `telecom` (inherited from SENVIA).

Primary org: **Perfect2Gether** (ID: `96a3950e-31be-4c6d-abed-b82968c0d7e9`).
Production URL: `https://app.perfect2gether.pt`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript 5.8, Vite 5.4 (SWC) |
| UI | shadcn/ui (Radix), Tailwind CSS 3.4, Framer Motion, Recharts |
| State | TanStack React Query 5, Zustand 5 |
| Backend | Supabase (PostgreSQL), 44 Edge Functions (Deno) |
| Auth | Supabase Auth (email/password) |
| Payments | Stripe (checkout, portal, webhooks) |
| Email | Brevo (transactional + campaigns) |
| Invoicing | InvoiceXpress / KeyInvoice |
| AI | OpenAI (Otto chatbot), Apify (prospect generation) |
| Deploy | Vercel (auto-deploy on push to master) |
| PWA | vite-plugin-pwa + Workbox |

## Project Structure

```
src/
├── components/       # UI components by module (clients/, sales/, proposals/, etc.)
│   └── ui/           # shadcn/ui primitives
├── contexts/         # React contexts (AuthContext)
├── hooks/            # 100+ custom hooks (data fetching, mutations, utilities)
├── integrations/     # Supabase client + generated types
├── lib/              # Utilities (format, export, import, constants)
├── pages/            # Route-level page components
├── stores/           # Zustand stores
└── types/            # TypeScript type definitions
supabase/
├── functions/        # 44 Edge Functions (Deno runtime)
└── migrations/       # 216 SQL migration files
```

## Key Commands

```bash
npm run dev          # Dev server on localhost:8080
npm run build        # Production build
npm run lint         # ESLint check
npx vercel --prod    # Deploy to production
npx tsc --noEmit     # Type check (run before every deploy)
```

## Architecture & Data Flow

1. **SPA** — All routes rewrite to `index.html` (vercel.json). React Router handles client-side routing.
2. **Data layer** — Components call custom hooks → hooks use TanStack Query → queries/mutations hit Supabase PostgREST or Edge Functions.
3. **Auth flow** — Supabase Auth → `profiles` table (auto-created via trigger) → `organization_members` for multi-tenancy → `user_roles` for global roles.
4. **Multi-tenancy** — Almost every table has `organization_id`. Queries always filter by it.
5. **Realtime** — `useRealtimeSubscription` hook subscribes to Supabase channels for live updates.
6. **Modules** — Feature flags stored in `organizations.enabled_modules` (JSON). Checked via `useModules()` hook.

### Key architectural decisions

- P2G org uses `niche === 'telecom'` (inherited from SENVIA). Energy-specific features gate on `modules.energy`.
- `isPerfect2GetherOrg()` checks org ID directly for P2G-only features (import, kWp hiding, etc.).
- CPE (Codigo Ponto de Entrega) = electricity delivery point, central to energy brokerage model.
- `total_mwh` on `crm_clients` is auto-calculated via DB trigger from CPE `consumo_anual` values.

## Supabase

**57 tables, 34 RPC functions, 60+ triggers, 44 Edge Functions.**
Full schema: [agent_docs/database_schema.md](agent_docs/database_schema.md)

### Core table groups

- **CRM:** `crm_clients`, `leads`, `prospects`, `cpes`, `client_communications`
- **Pipeline:** `proposals`, `proposal_cpes`, `sales`, `sale_payments`
- **Finance:** `invoices`, `credit_notes`, `expenses`, `bank_accounts`, `commission_closings`
- **Marketing:** `email_templates`, `email_campaigns`, `email_sends`, `email_automations`
- **System:** `organizations`, `profiles`, `user_roles`, `organization_members`

### Migrations

SQL files in `supabase/migrations/`. Naming: `YYYYMMDDHHMMSS_description.sql`.
Applied manually via Supabase SQL Editor (no CLI deploy configured — no access token stored).

### Edge Functions

Deploy: `npx supabase functions deploy <function-name>` (requires `npx supabase login` first).
Full list: [agent_docs/database_schema.md](agent_docs/database_schema.md#edge-functions)

## Vercel

- **Environment:** Production only (no preview/staging)
- **Domain:** `app.perfect2gether.pt`
- **Auto-deploy:** Push to `master` triggers build
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Build:** Vite, Node 24.x

Full deploy process: [agent_docs/deployment.md](agent_docs/deployment.md)

## GitHub

- **Repo:** `github.com/Senvia/perfect2gether`
- **Branch:** `master` only (no branching strategy)
- **CI/CD:** None (no GitHub Actions). Vercel auto-deploys on push.
- **Commit convention:** `feat:`, `fix:`, `chore:` prefixes, messages in Portuguese
- **Co-author:** Add `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` when Claude creates commits

## Development Rules

1. **Always run `npx tsc --noEmit` before deploying.** TypeScript errors break Vercel builds.
2. **Never modify `src/integrations/supabase/types.ts` manually.** It's generated from Supabase schema.
3. **UI text is in Portuguese (PT-PT).** All labels, messages, placeholders.
4. **File encoding must be UTF-8.** Garbled accents (e.g., `ComissÃ£o`) are caused by wrong encoding — always verify Portuguese characters render correctly.
5. **localStorage keys must be versioned** (e.g., `clients-filters-v2`). When changing persisted state shape, bump the version to avoid stale state.
6. **Email and phone are always required** on client forms (hardcoded, not settings-dependent).
7. **Distrito and Concelho are required** on client forms. Note: the DB column is `conselho` but the UI label is "Concelho" (correct Portuguese spelling).
8. **kWp metric is hidden for P2G org** — it's a solar panel metric, not relevant for energy brokerage.
9. **After writing code, deploy with `npx vercel --prod`** when the user asks for it.
10. **Supabase DDL changes** must be run manually in the Supabase SQL Editor (no CLI access token configured).

## Agent Docs

- [conventions.md](agent_docs/conventions.md) — Project conventions and decisions that worked
- [database_schema.md](agent_docs/database_schema.md) — Full Supabase schema, tables, triggers, Edge Functions
- [deployment.md](agent_docs/deployment.md) — Step-by-step deploy process, env vars, rollback

## TODO

- [ ] Confirm RLS status per table in Supabase Dashboard
- [ ] Document cron jobs configured in Supabase Dashboard (check-reminders, check-fidelization-alerts, etc.)
- [ ] List Supabase Edge Function secrets (Brevo, OpenAI, Stripe, InvoiceXpress API keys)
- [ ] Configure `npx supabase login` for CLI-based migration deploys
- [ ] Set up custom domain `app.perfect2gether.pt` in Vercel domains list (currently only aliased)
