import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { queryRetryDelay, requireReadSuccess, shouldRetryQuery } from './query-resilience.ts';

test('permission/auth failures are not retried, including plain PostgREST objects', () => {
  for (const error of [
    { code: '42501', message: 'permission denied' },
    { code: 'PGRST301' }, { code: 'PGRST302' }, { code: 'PGRST303' },
    { status: 401 }, { context: { status: 403 } }, new Error('Unauthorized'),
  ]) assert.equal(shouldRetryQuery(0, error), false);
});

test('outages get one bounded retry; unknown errors get at most two', () => {
  for (const error of [
    { code: 'PGRST002', message: 'Could not query the database for the schema cache' },
    { code: '53300' }, { code: '57014' }, { status: 503 }, { status: 429 },
    new TypeError('Failed to fetch'), new Error('Gateway 504'),
  ]) {
    assert.equal(shouldRetryQuery(0, error), true);
    assert.equal(shouldRetryQuery(1, error), false);
  }
  assert.equal(shouldRetryQuery(1, new Error('Unexpected response')), true);
  assert.equal(shouldRetryQuery(2, new Error('Unexpected response')), false);
});

test('retries are spaced, jittered and capped', () => {
  const first = queryRetryDelay(0);
  assert.ok(first >= 5_000 && first < 7_500);
  const second = queryRetryDelay(1);
  assert.ok(second >= 10_000 && second < 12_500);
  assert.equal(queryRetryDelay(10), 30_000);
});

test('successful empty responses remain valid, partial failed responses do not', () => {
  assert.deepEqual(requireReadSuccess({ data: [], error: null }), []);
  const error = { code: 'PGRST002' };
  assert.throws(() => requireReadSuccess({ data: ['partial'], error }), e => e === error);
});

test('503 preserves last good modules/type map and recovery replaces them', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  try {
    for (const [key, previous, recovered] of [
      [['modules', 'org-a'], { sales: true, energy: false }, { sales: true, energy: true }],
      [['client-proposal-types', 'org-a'], { cpe: ['energia'] }, { cpe: ['energia', 'servicos'] }],
    ] as const) {
      client.setQueryData(key, previous);
      await assert.rejects(client.fetchQuery({
        queryKey: key,
        queryFn: async () => requireReadSuccess({ data: null, error: new Error('503') }),
      }));
      assert.deepEqual(client.getQueryData(key), previous);
      assert.equal(client.getQueryState(key)?.status, 'error');
      assert.equal(client.getQueryData([key[0], 'org-b']), undefined);
      await client.fetchQuery({ queryKey: key, queryFn: async () => requireReadSuccess({ data: recovered, error: null }) });
      assert.deepEqual(client.getQueryData(key), recovered);
    }
  } finally {
    client.clear();
  }
});

test('real retry policy stops after two outage requests without caching a fake success', async () => {
  const client = new QueryClient({ defaultOptions: { queries: {
    retry: shouldRetryQuery, retryDelay: 0, gcTime: 0,
  } } });
  let calls = 0;
  try {
    await assert.rejects(client.fetchQuery({ queryKey: ['outage'], queryFn: async () => {
      calls++;
      return requireReadSuccess({ data: null, error: { code: 'PGRST002' } });
    } }));
    assert.equal(calls, 2);
    assert.equal(client.getQueryState(['outage'])?.status, 'error');
  } finally {
    client.clear();
  }
});
