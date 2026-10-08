import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../../node_modules/typescript/lib/typescript.js";
const dataUrl = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const zod = new URL("../../node_modules/zod/index.js", import.meta.url).href;
const core = dataUrl(
  compile(
    (
      await readFile(
        new URL("../functions/rh-notification-worker/core.ts", import.meta.url),
        "utf8",
      )
    ).replace("npm:zod@3.25.76", zod),
  ),
);
let env, calls, permission, claimedRows, transportCalls, orgConfig, updates;
globalThis.Deno = { env: { get: (key) => env[key] } };
globalThis.__rhFakeClientFactory = () => ({
  rpc: async (name) => {
    calls.push(name);
    return {
      data:
        name === "rh_can"
          ? permission
          : name === "rh_email_claim"
            ? claimedRows
            : name === "rh_storage_cleanup_claim"
              ? []
              : 0,
      error: null,
    };
  },
  from: (table) => {
    let selection = "";
    let rowId;
    const chain = {
      select: (columns) => {
        selection = columns;
        return chain;
      },
      eq: (field, value) => {
        if (field === "id") rowId = value;
        return chain;
      },
      update: (values) => {
        updates.push(values);
        return chain;
      },
      single: async () => ({ data: orgConfig, error: null }),
      maybeSingle: async () => ({
        data:
          table === "organizations"
            ? orgConfig
            : selection === "id"
              ? { id: rowId ?? claimedRows[0]?.id }
              : {
                  state: "processing",
                  claimed_at:
                    claimedRows.find((r) => r.id === rowId)?.claimed_at ??
                    claimedRows[0]?.claimed_at,
                },
        error: null,
      }),
      then: (resolve) => resolve({ data: null, error: null }),
    };
    return chain;
  },
});
globalThis.__rhTestTransport = async (...args) => {
  transportCalls.push(args);
};
const cleanup = dataUrl(
  compile(
    (
      await readFile(
        new URL(
          "../functions/rh-notification-worker/cleanup.ts",
          import.meta.url,
        ),
        "utf8",
      )
    ).replace("npm:zod@3.25.76", zod),
  ),
);
let source = await readFile(
  new URL("../functions/rh-notification-worker/index.ts", import.meta.url),
  "utf8",
);
source = source
  .replace(
    "npm:ky@1.10.0",
    dataUrl(
      "export class HTTPError extends Error{};export default {post:(...args)=>globalThis.__rhTestTransport(...args)}",
    ),
  )
  .replace(
    "https://deno.land/std@0.190.0/http/server.ts",
    dataUrl("export function serve(handler){globalThis.__rhHandler=handler}"),
  )
  .replace(
    "https://esm.sh/@supabase/supabase-js@2",
    dataUrl(
      "export function createClient(...args){return globalThis.__rhFakeClientFactory(...args)}",
    ),
  )
  .replace("npm:zod@3.25.76", zod)
  .replace("./core.ts", core)
  .replace("./cleanup.ts", cleanup);
await import(dataUrl(compile(source)));
const org = "00000000-0000-4000-8000-000000000100";
function reset() {
  env = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "anon-fixture",
    SUPABASE_SERVICE_ROLE_KEY: "service-fixture",
    RH_WORKER_SECRET: "worker-fixture",
    RH_WORKER_ORGANIZATION_ID: org,
  };
  calls = [];
  updates = [];
  permission = true;
  claimedRows = [];
  transportCalls = [];
  orgConfig = {
    name: "Fixture company",
    brevo_api_key: "org-key-fixture",
    brevo_sender_email: "rh@example.test",
  };
}
function request(
  body = { organization_id: org, dry_run: true },
  headers = { Authorization: "Bearer user-fixture" },
  method = "POST",
) {
  return new Request("http://127.0.0.1/worker", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
test("handler rejects unsupported methods", async () => {
  reset();
  assert.equal(
    (await globalThis.__rhHandler(request(undefined, {}, "GET"))).status,
    405,
  );
});
test("handler rejects unauthenticated users", async () => {
  reset();
  assert.equal(
    (await globalThis.__rhHandler(request(undefined, {}))).status,
    401,
  );
  assert.deepEqual(calls, []);
});
test("handler enforces RH permission and MFA result for human requests", async () => {
  reset();
  permission = false;
  assert.equal((await globalThis.__rhHandler(request())).status, 403);
  assert.deepEqual(calls, ["rh_can"]);
});
test("handler rejects scheduler secret without matching service bearer", async () => {
  reset();
  assert.equal(
    (
      await globalThis.__rhHandler(
        request(undefined, {
          Authorization: "Bearer anon-fixture",
          "x-rh-worker-secret": "worker-fixture",
        }),
      )
    ).status,
    403,
  );
  assert.deepEqual(calls, []);
});
test("handler rejects scheduler organization mismatch even with both secrets", async () => {
  reset();
  assert.equal(
    (
      await globalThis.__rhHandler(
        request(
          {
            organization_id: "00000000-0000-4000-8000-000000000200",
            dry_run: true,
          },
          {
            Authorization: "Bearer service-fixture",
            "x-rh-worker-secret": "worker-fixture",
          },
        ),
      )
    ).status,
    403,
  );
  assert.deepEqual(calls, []);
});
test("scheduler dry run reads queue but never ticks sends or claims for delivery", async () => {
  reset();
  const response = await globalThis.__rhHandler(
    request(undefined, {
      Authorization: "Bearer service-fixture",
      "x-rh-worker-secret": "worker-fixture",
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["rh_email_claim"]);
  assert.deepEqual(await response.json(), { dry_run: true, results: [] });
});
test("delivery remains disabled until explicit worker configuration", async () => {
  reset();
  const response = await globalThis.__rhHandler(
    request({ organization_id: org, dry_run: false }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(calls, ["rh_can"]);
});
test("authorized configured scheduler processes due reminders before email queue", async () => {
  reset();
  env.RH_EMAIL_DELIVERY_ENABLED = "true";
  const response = await globalThis.__rhHandler(
    request(
      { organization_id: org, dry_run: false },
      {
        Authorization: "Bearer service-fixture",
        "x-rh-worker-secret": "worker-fixture",
      },
    ),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    "rh_notification_tick",
    "rh_storage_cleanup_claim",
    "rh_email_claim",
  ]);
});
test("handler parses dry-run as boolean and rejects ambiguous payload", async () => {
  reset();
  assert.equal(
    (
      await globalThis.__rhHandler(
        request({ organization_id: org, dry_run: "false" }),
      )
    ).status,
    400,
  );
  assert.deepEqual(calls, []);
});
test("delivery uses organization Brevo sender and key after authorization", async () => {
  reset();
  env.RH_EMAIL_DELIVERY_ENABLED = "true";
  env.BREVO_API_KEY = "fallback-fixture";
  env.RH_EMAIL_SENDER = "fallback@example.test";
  claimedRows = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      organization_id: org,
      user_id: "00000000-0000-4000-8000-000000000001",
      state: "processing",
      channel: "email",
      due_at: "2020-01-01T00:00:00Z",
      claimed_at: "2026-10-08T12:00:00Z",
      attempts: 1,
      payload: { title: "Novo pedido RH", to: "recipient@example.test" },
    },
  ];
  const result = await globalThis.__rhHandler(
    request({ organization_id: org, dry_run: false }),
  );
  assert.equal(result.status, 200);
  assert.equal(transportCalls.length, 1);
  assert.equal(transportCalls[0][1].headers["api-key"], "org-key-fixture");
  assert.deepEqual(transportCalls[0][1].json.sender, {
    email: "rh@example.test",
    name: "Fixture company",
  });
});

test("one malformed email is terminally failed while valid batch row is delivered", async () => {
  reset();
  env.RH_EMAIL_DELIVERY_ENABLED = "true";
  const base = {
    organization_id: org,
    user_id: "00000000-0000-4000-8000-000000000001",
    state: "processing",
    channel: "email",
    due_at: "2020-01-01T00:00:00Z",
    claimed_at: "2026-10-08T12:00:00Z",
    attempts: 1,
  };
  claimedRows = [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000502",
      payload: { title: "Invalid", to: "a@b..c" },
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000503",
      payload: { title: "Valid", to: "valid@example.test" },
    },
  ];
  const response = await globalThis.__rhHandler(
    request({ organization_id: org, dry_run: false }),
  );
  assert.equal(response.status, 200);
  assert.equal(transportCalls.length, 1);
  assert.equal(transportCalls[0][1].json.to[0].email, "valid@example.test");
  assert.ok(updates.some((u) => u.state === "failed" && u.attempts === 5));
  assert.ok(updates.some((u) => u.state === "delivered"));
});
