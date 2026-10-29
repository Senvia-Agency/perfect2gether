import assert from "node:assert/strict";
import test from "node:test";

import {
  EdpApiError,
  EdpRevisionConflictError,
  toEdpApiError,
} from "./api-errors.ts";

test("Postgres serialization conflict becomes a typed revision conflict", () => {
  const error = toEdpApiError({ code: "40001", message: "edp_revision_conflict" });

  assert.ok(error instanceof EdpRevisionConflictError);
  assert.equal(error.kind, "revision_conflict");
});

test("permission errors stay distinct from validation and transport errors", () => {
  const error = toEdpApiError({ code: "42501", message: "Venda indisponível." });

  assert.ok(error instanceof EdpApiError);
  assert.equal(error.kind, "permission");
  assert.equal(error.message, "Venda indisponível.");
});

test("ordinary browser errors are preserved as transport failures", () => {
  const error = toEdpApiError(new TypeError("Failed to fetch"));

  assert.equal(error.kind, "transport");
  assert.equal(error.message, "Failed to fetch");
});
