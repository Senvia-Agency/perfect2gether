import { setTimeout as wait } from "node:timers/promises";
const endpoint = new URL(
  process.env.LOCAL_RH_WORKER_URL ??
    "http://127.0.0.1:54321/functions/v1/rh-notification-worker",
);
if (!["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname))
  throw new Error("The local runner only accepts localhost");
const org = process.env.RH_WORKER_ORGANIZATION_ID;
const secret = process.env.RH_WORKER_SECRET;
const key = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
if (!org || !secret || !key)
  throw new Error(
    "Configure RH_WORKER_ORGANIZATION_ID, RH_WORKER_SECRET and LOCAL_SUPABASE_SERVICE_ROLE_KEY for a local instance",
  );
const dryRun = !process.argv.includes("--deliver");
do {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "x-rh-worker-secret": secret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ organization_id: org, dry_run: dryRun }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Local worker returned ${response.status}`);
  console.log(await response.json());
  if (!process.argv.includes("--watch")) break;
  await wait(60000);
} while (true);
