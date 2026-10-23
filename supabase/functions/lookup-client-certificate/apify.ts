import { z } from 'zod';


export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), organizationId: z.string().uuid(), crcCode: z.string().trim().regex(/^\d{4}-\d{4}-\d{4}$/) }).strict(),
  z.object({ action: z.literal('status'), organizationId: z.string().uuid(), runId: z.string().uuid() }).strict(),
]);
export const certificateSchema = z.object({
  nipc: z.string().nullable(), denominacao: z.string().nullable(),
  cae: z.array(z.object({ codigo: z.string(), descricao: z.string(), principal: z.boolean() })),
  gerentes: z.array(z.object({ nome: z.string(), nif: z.string().nullable().default(null) })),
  ok: z.boolean(), erro: z.string().nullable().default(null),
});
const runSchema = z.object({ data: z.object({ id: z.string().regex(/^[\w-]+$/), status: z.string(), defaultDatasetId: z.string().regex(/^[\w-]+$/).optional() }) });
class CertificateProviderError extends Error { constructor() { super('Certificate provider unavailable'); } }
export type Certificate = z.infer<typeof certificateSchema>;

export function certificateApi(config: { readonly token: string; readonly taskId: string; readonly fetch?: typeof fetch }) {
  // Follow this Edge Function codebase's fetch convention, with explicit timeout,
  // HTTP checks and no retries (a retried POST could create a paid duplicate).
  const send = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await (config.fetch ?? fetch)(`https://api.apify.com/v2/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new CertificateProviderError();
    return response.json();
  };
  return {
    async start(crcCode: string) {
      const response = await send(`actor-tasks/${encodeURIComponent(config.taskId)}/runs?timeout=180`, { customData: { crcCode } });
      return runSchema.parse(response).data.id;
    },
    async status(runId: string): Promise<{ readonly status: 'RUNNING' | 'FAILED' | 'SUCCEEDED'; readonly data?: Certificate; readonly error?: string }> {
      const run = runSchema.parse(await send(`actor-runs/${encodeURIComponent(runId)}`)).data;
      if (['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'].includes(run.status)) return { status: 'RUNNING' };
      if (run.status !== 'SUCCEEDED' || !run.defaultDatasetId) return { status: 'FAILED' };
      const items = z.array(certificateSchema).min(1).parse(await send(`datasets/${run.defaultDatasetId}/items?clean=true&limit=1`));
      const data = items[0];
      if (!data || !data.ok || !data.nipc || !/^\d{9}$/.test(data.nipc) || !data.denominacao?.trim()) {
        return { status: 'FAILED', error: 'A certidão não devolveu dados completos. Confirme o código CRC e tente novamente.' };
      }
      return { status: 'SUCCEEDED', data };
    },
  };
}



