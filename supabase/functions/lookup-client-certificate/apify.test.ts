import { test, expect } from 'bun:test';
import { certificateApi, requestSchema } from './apify.ts';
const fixture = { nipc: '501234567', denominacao: 'Empresa', cae: [{ codigo: '62010', descricao: 'Programação', principal: true }], gerentes: [{ nome: 'Gerente', nif: null }], ok: true, erro: null };
function mockApi(responses: readonly unknown[]) {
  const calls: { url: string; body: string | null }[] = [];
  let index = 0;
  const fakeFetch: typeof fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : null });
    return Response.json(responses[index++]);
  }, { preconnect() {} });
  return { calls, api: certificateApi({ token: 'test-secret', taskId: 'saved-task', fetch: fakeFetch }) };
}
test('only valid CRC and scoped request shapes are accepted', () => {
  expect(requestSchema.safeParse({ action: 'start', organizationId: '96a3950e-31be-4c6d-abed-b82968c0d7e9', crcCode: '1234-5678-9012' }).success).toBe(true);
  expect(requestSchema.safeParse({ action: 'start', organizationId: '96a3950e-31be-4c6d-abed-b82968c0d7e9', crcCode: 'invalid' }).success).toBe(false);
  expect(requestSchema.safeParse({ action: 'status', organizationId: 'bad', runId: 'provider-id' }).success).toBe(false);
});
test('starts saved task with CRC override only, token never in URL', async () => {
  const { api, calls } = mockApi([{ data: { id: 'provider-run', status: 'READY' } }]);
  expect(await api.start('1234-5678-9012')).toBe('provider-run');
  expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ customData: { crcCode: '1234-5678-9012' } });
  expect(calls[0]?.url).not.toContain('test-secret');
  expect(calls).toHaveLength(1);
});
test('polls running and failed runs without fetching datasets', async () => {
  const { api, calls } = mockApi([{ data: { id: 'run', status: 'RUNNING' } }, { data: { id: 'run', status: 'TIMED-OUT' } }]);
  expect(await api.status('run')).toEqual({ status: 'RUNNING' });
  expect(await api.status('run')).toEqual({ status: 'FAILED' });
  expect(calls).toHaveLength(2);
});
test('validates completed dataset and rejects malformed output', async () => {
  const run = { data: { id: 'run', status: 'SUCCEEDED', finishedAt: '2026-10-23T08:00:00.000Z', defaultDatasetId: 'dataset' } };
  const { api } = mockApi([run, [fixture], run, [{ nipc: 123 }]]);
  expect(await api.status('run')).toEqual({ status: 'SUCCEEDED', data: fixture, checkedAt: '2026-10-23T08:00:00.000Z' });
  await expect(api.status('run')).rejects.toThrow();
});

test('semantic failures cannot produce a succeeded certificate', async () => {
  const run = { data: { id: 'run', status: 'SUCCEEDED', finishedAt: '2026-10-23T08:00:00.000Z', defaultDatasetId: 'dataset' } };
  const { api } = mockApi([run, [{ ...fixture, ok: false, erro: 'private provider diagnostic' }], run, [{ ...fixture, nipc: null }]]);
  const failed = await api.status('run');
  expect(failed.status).toBe('FAILED');
  expect(failed.error).toContain('Confirme o código CRC');
  expect(JSON.stringify(failed)).not.toContain('private provider diagnostic');
  expect((await api.status('run')).status).toBe('FAILED');
});

