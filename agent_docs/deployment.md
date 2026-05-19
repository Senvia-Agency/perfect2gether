# Deployment Guide

## Production Deploy (Vercel)

### Prerequisites
- Vercel CLI installed (`npm i -g vercel`)
- Authenticated (`npx vercel login` or token in `.vercel/`)
- Project linked (`npx vercel link`)

### Step-by-step

1. **Type check** — Catch errors before building:
   ```bash
   npx tsc --noEmit
   ```

2. **Deploy** — Push to production:
   ```bash
   npx vercel --prod
   ```
   This builds and deploys to `app.perfect2gether.pt`.

3. **Verify** — Check the deployment URL in the output. Open it in a browser.

### Alternative: Git push
Pushing to `master` triggers an automatic Vercel build. No manual deploy needed if using this workflow.

---

## Environment Variables

### Vercel (Production)
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

### Local (.env file, not committed)
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_URL` | Supabase URL (for CLI/scripts) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access, never expose to client) |

### Supabase Edge Functions (configured in Supabase Dashboard)
| Secret | Used by |
|--------|---------|
| `BREVO_API_KEY` | send-template-email, brevo-webhook |
| `OPENAI_API_KEY` | otto-chat |
| `STRIPE_SECRET_KEY` | create-checkout, stripe-webhook |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook |
| `APIFY_API_TOKEN` | generate-prospects |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | send-push-notification |

> **TODO:** Confirm the complete list of Edge Function secrets in Supabase Dashboard → Settings → Edge Functions → Secrets.

---

## Supabase Schema Changes

### DDL (CREATE TABLE, ALTER TABLE, etc.)
1. Write SQL migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Run it manually in **Supabase Dashboard → SQL Editor**
3. If the migration adds/changes columns, regenerate types (or manually update `src/integrations/supabase/types.ts`)

### Edge Functions
```bash
npx supabase login              # One-time auth
npx supabase functions deploy <function-name> --project-ref zycrksvkdpondqpplqce
```

> **Note:** As of the current setup, `npx supabase login` has not been run. Schema changes are applied via the SQL Editor in the Supabase Dashboard.

---

## Rollback

### Vercel
1. Go to [Vercel Dashboard](https://vercel.com) → Project → Deployments
2. Find the last working deployment
3. Click **"..."** → **"Promote to Production"**

Or via CLI:
```bash
npx vercel rollback
```

### Supabase
- **No automated rollback.** Write a reverse migration SQL and run it in the SQL Editor.
- Edge Functions: Redeploy the previous version from git history.

---

## Pre-deploy Checklist

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] Portuguese characters render correctly (no `Ã£` or `Â·`)
- [ ] Tested locally with `npm run dev`
- [ ] No `.env` or secrets in committed files
- [ ] If localStorage state shape changed, bumped the persisted key version
