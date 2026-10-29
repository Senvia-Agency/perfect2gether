import assert from "node:assert/strict";
import test from "node:test";

import {
  getEdpTransportLabel,
  nextDispatchKey,
  parseRecipientList,
} from "./logic.ts";

test("a transport retry reuses the original idempotency key", () => {
  const key = nextDispatchKey("transport_error", "request-1", () => "request-2");

  assert.equal(key, "request-1");
});

test("an explicit retry after a failed pre-send attempt uses a fresh key", () => {
  const key = nextDispatchKey("failed", "request-1", () => "request-2");

  assert.equal(key, "request-2");
});

test("accepted and uncertain dispatches cannot be retried", () => {
  assert.equal(nextDispatchKey("accepted", "request-1", () => "request-2"), null);
  assert.equal(nextDispatchKey("uncertain", "request-1", () => "request-2"), null);
});

test("the first dispatch creates one idempotency key", () => {
  assert.equal(nextDispatchKey("idle", null, () => "request-1"), "request-1");
});

test("recipient lists are trimmed and deduplicated without changing order", () => {
  assert.deepEqual(
    parseRecipientList(" edp@example.test; BO@example.test\nedp@example.test, "),
    ["edp@example.test", "BO@example.test"],
  );
});

test("transport acceptance is never labelled as delivery", () => {
  assert.equal(getEdpTransportLabel("accepted"), "Aceite pelo transporte");
  assert.notEqual(getEdpTransportLabel("accepted"), "Entregue");
});
