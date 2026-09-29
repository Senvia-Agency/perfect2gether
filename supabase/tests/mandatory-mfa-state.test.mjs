import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMfaStatus } from '../../src/lib/mfaAccess.ts';

for (const [label, required, currentLevel, nextLevel, expected] of [
  ['mandatory without a factor', true, 'aal1', 'aal1', 'needs_enrollment'],
  ['mandatory with factor pending', true, 'aal1', 'aal2', 'pending'],
  ['mandatory and verified', true, 'aal2', 'aal2', 'verified'],
  ['mandatory with removed factor and stale token', true, 'aal2', 'aal1', 'needs_enrollment'],
  ['optional without factor', false, 'aal1', 'aal1', 'none'],
  ['optional with factor pending', false, 'aal1', 'aal2', 'pending'],
  ['optional and verified', false, 'aal2', 'aal2', 'verified'],
]) {
  test(`resolves ${label}`, () => {
    assert.equal(resolveMfaStatus(required, { currentLevel, nextLevel }), expected);
  });
}
