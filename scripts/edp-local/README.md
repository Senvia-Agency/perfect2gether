# P2G EDP local environment

This directory is the only entry point for the task-1 local stack. It uses a separate Supabase workdir and project id (`p2g-edp-local`), while the repository's production-linked `supabase/config.toml` remains untouched.

## Start

From the repository root, run:

```powershell
pwsh -NoProfile -File .\scripts\edp-local\start.ps1
```

The launcher performs the following checks before invoking Supabase:

- requires an `http` loopback endpoint and the exact local project id;
- refuses the hosted project id `zycrksvkdpondqpplqce` and every `*.supabase.co` URL;
- starts Docker Desktop hidden if the daemon is not ready, then waits a bounded 90 seconds;
- resolves an installed `supabase` binary first and uses `npx --yes supabase` only when no binary is available;
- starts Supabase from this directory, not from the production-linked root workdir.

If Docker is unavailable, the command exits without running Supabase, migrations, functions, or any remote operation. Use `-DockerWaitSeconds 0` for a fast diagnostic.

The first successful start applies the repository migrations through runtime mirrors at `supabase/migrations` and `supabase/functions` inside this directory. The mirrors are refreshed without symlink privileges before each Supabase command. It also applies `supabase/seed.sql`.

## Local services

| Service | URL or port |
| --- | --- |
| Supabase API | `http://127.0.0.1:54321` |
| Postgres | `127.0.0.1:54322` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Inbucket web UI | `http://127.0.0.1:54324` |
| Inbucket SMTP | `127.0.0.1:54325` |
| Inbucket POP3 | `127.0.0.1:54326` |
| Edge Runtime inspector | `127.0.0.1:8083` |
| P2G Vite dev server | `http://127.0.0.1:8080` |

Emails remain inside Inbucket. The local Auth SMTP host is `inbucket:2500` inside Docker; the host capture endpoint is `127.0.0.1:54325`.

## Generated local environment

`start.ps1` writes the CLI-generated local URL and keys to `scripts/edp-local/.env.local` (ignored by git). No key is printed by the launcher. To run the app with those values in the current process, use:

```powershell
pwsh -NoProfile -File .\scripts\edp-local\run-app.ps1
```

`run-app.ps1` refuses to start if the generated URL is not loopback. It binds Vite to `127.0.0.1:8080` and does not read or overwrite the repository `.env` file.

## Fictitious native-login accounts

Every account uses the normal Supabase email/password login surface. The password for all accounts is `P2gLocal!2026`.

| Account | Role | Organization |
| --- | --- | --- |
| `admin@p2g.local` | `super_admin` | Local Norte and Local Sul |
| `bo@p2g.local` | `viewer` with `Back Office` profile | Local Norte |
| `comercial.a@p2g.local` | `salesperson` | Local Norte |
| `comercial.b@p2g.local` | `salesperson` | Local Norte |
| `comercial.c@p2g.local` | `salesperson` | Local Sul |

The organizations are `p2g-local-org-a` and `p2g-local-org-b`. Local Norte uses the product's P2G feature-gate UUID (`96a3950e-31be-4c6d-abed-b82968c0d7e9`) inside the isolated local database only, so P2G-specific policies are exercised without reading production. They contain no production records or credentials.

## Operations

```powershell
pwsh -NoProfile -File .\scripts\edp-local\status.ps1
pwsh -NoProfile -File .\scripts\edp-local\seed.ps1
pwsh -NoProfile -File .\scripts\edp-local\stop.ps1
pwsh -NoProfile -File .\scripts\edp-local\assert-local.ps1 -Url http://127.0.0.1:54321 -ProjectId p2g-edp-local
node --test .\scripts\edp-local\tests\environment.test.mjs
```

`seed.ps1` runs `supabase db reset --local --yes`, so it destroys and recreates only this local stack. It never runs `db push`, `supabase link`, `functions deploy`, Vercel commands, or any hosted API call.

The scripts intentionally do not run `supabase login`; native app login is performed in the browser using the fictitious accounts above.
