import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../../node_modules/typescript/lib/typescript.js";
const source = (
  await readFile(
    new URL("../functions/rh-notification-worker/core.ts", import.meta.url),
    "utf8",
  )
).replace(
  "npm:zod@3.25.76",
  new URL("../../node_modules/zod/index.js", import.meta.url).href,
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { processRhEmails, queuedEmailSchema, RhDeliveryUncertainError } =
  await import(
    "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
  );
const row = {
  id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-000000000100",
  user_id: "00000000-0000-4000-8000-000000000002",
  state: "queued",
  channel: "email",
  due_at: "2099-01-01T00:00:00Z",
  attempts: 0,
  payload: { title: "Aviso RH", to: "rh@example.test" },
};
test("dry-run preview never invokes delivery nor marks delivered", async () => {
  let calls = 0;
  const results = await processRhEmails([queuedEmailSchema.parse(row)], {
    now: new Date("2099-01-02"),
    dryRun: true,
    deliver: async () => {
      calls++;
    },
    complete: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
  assert.deepEqual(results, [{ id: row.id, state: "preview" }]);
});
test("delivery completes only after injected transport succeeds", async () => {
  const events = [];
  const results = await processRhEmails([queuedEmailSchema.parse(row)], {
    now: new Date("2099-01-02"),
    dryRun: false,
    deliver: async (message) => {
      events.push(["sent", message.to]);
    },
    complete: async (id, state) => {
      events.push([id, state]);
    },
  });
  assert.deepEqual(events, [
    ["sent", row.payload.to],
    [row.id, "delivered"],
  ]);
  assert.equal(results[0].state, "delivered");
});
test("failed transport records failure and never delivery", async () => {
  const states = [];
  const results = await processRhEmails([queuedEmailSchema.parse(row)], {
    now: new Date("2099-01-02"),
    dryRun: false,
    deliver: async () => {
      throw new Error("Offline");
    },
    complete: async (id, state, error) => {
      states.push([state, error]);
    },
  });
  assert.deepEqual(states, [["failed", "Offline"]]);
  assert.equal(results[0].state, "failed");
});
test("successful send with failed acknowledgement becomes uncertain and is not failed retry", async () => {
  const states = [];
  const result = await processRhEmails([queuedEmailSchema.parse(row)], {
    now: new Date("2099-01-02"),
    dryRun: false,
    deliver: async () => {},
    complete: async (id, state) => {
      states.push(state);
      if (state === "delivered") throw new Error("DB offline");
    },
  });
  assert.deepEqual(states, ["delivered", "uncertain"]);
  assert.equal(result[0].state, "uncertain");
});

test("ambiguous transport outcome is uncertain without automatic failure retry", async () => {
  const states = [];
  const results = await processRhEmails([queuedEmailSchema.parse(row)], {
    now: new Date("2099-01-02"),
    dryRun: false,
    deliver: async () => {
      throw new RhDeliveryUncertainError("Timeout after sending");
    },
    complete: async (id, state) => {
      states.push(state);
    },
  });
  assert.deepEqual(states, ["uncertain"]);
  assert.equal(results[0].state, "uncertain");
});
const cleanupSource = (
  await readFile(
    new URL("../functions/rh-notification-worker/cleanup.ts", import.meta.url),
    "utf8",
  )
).replace(
  "npm:zod@3.25.76",
  new URL("../../node_modules/zod/index.js", import.meta.url).href,
);
const cleanupCode = ts.transpileModule(cleanupSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { processRhStorageCleanups } = await import(
  "data:text/javascript;base64," + Buffer.from(cleanupCode).toString("base64")
);
test("cleanup removes bytes before acknowledging and retries only failures", async () => {
  const events = [];
  const jobs = [
    {
      id: row.id,
      organization_id: row.organization_id,
      path: "first",
      claimed_at: "2099-01-01",
    },
    {
      id: row.user_id,
      organization_id: row.organization_id,
      path: "second",
      claimed_at: "2099-01-01",
    },
  ];
  await processRhStorageCleanups(jobs, {
    remove: async (path) => {
      events.push(path);
      if (path === "first") throw new Error("Offline");
    },
    complete: async (job, state) => {
      events.push([job.path, state]);
    },
  });
  assert.deepEqual(events, [
    "first",
    ["first", "failed"],
    "second",
    ["second", "done"],
  ]);
});
