import assert from "node:assert/strict";
import test from "node:test";

import { isEdpCaptureEnabled, isEdpUiHost } from "./environment.ts";

test("the EDP workspace is available on local and hosted browser origins", () => {
  assert.equal(isEdpUiHost("localhost"), true);
  assert.equal(isEdpUiHost("127.0.0.1"), true);
  assert.equal(isEdpUiHost("app.perfect2gether.pt"), true);
  assert.equal(isEdpUiHost(""), false);
});

test("capture transport requires both localhost and an explicit flag", () => {
  assert.equal(isEdpCaptureEnabled("localhost", "true"), true);
  assert.equal(isEdpCaptureEnabled("localhost", "false"), false);
  assert.equal(isEdpCaptureEnabled("app.perfect2gether.pt", "true"), false);
});
