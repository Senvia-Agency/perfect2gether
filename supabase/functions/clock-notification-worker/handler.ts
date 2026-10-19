import { z } from 'npm:zod@3.25.76';
import { ClockError, clockFailure, clockResponse } from '../_shared/clock-contract.ts';
import { equalSecret } from '../_shared/clock-crypto.ts';
export const clockJobSchema = z.object({
    id: z.string().uuid(), organization_id: z.string().uuid(), user_id: z.string().uuid(), channel: z.enum(['notification', 'push', 'email']), event_key: z.string(), title: z.string(), body: z.string(), payload: z.record(z.unknown()), claimed_at: z.string(), attempts: z.number().int().nonnegative()
}).passthrough();
export type ClockJob = z.infer<typeof clockJobSchema>;
export type ClockWorkerDependencies = {
    readonly secret: string | undefined;
    readonly deliveryEnabled: boolean;
    readonly rpc: (action: 'enqueue_reminders' | 'claim' | 'complete', input: Readonly<Record<string, unknown>>) => Promise<unknown>;
    readonly deliver: (job: ClockJob, message: {
        readonly title: string;
        readonly body: string;
        readonly url: string;
        readonly idempotencyKey: string;
    }) => Promise<void>;
};
function reminderTitle(job: ClockJob): string {
    const action = z.enum(['start', 'pause', 'resume', 'stop']).safeParse(job.payload.action);
    if (!action.success)
        return 'Registo de ponto';
    switch (action.data) {
        case 'start': return 'Já registou a entrada?';
        case 'pause': return 'Já registou o almoço?';
        case 'resume': return 'Já registou o regresso?';
        case 'stop': return 'Já registou a saída?';
    }
}
const workerInput = z.object({
    limit: z.number().int().min(1).max(100).default(50)
}).strict();
export function createClockWorkerHandler(deps: ClockWorkerDependencies): (request: Request) => Promise<Response> {
    return async (request) => {
        if (request.method !== 'POST')
            return clockResponse({
                error: 'method_not_allowed'
            }, 405);
        try {
            const supplied = request.headers.get('x-clock-worker-secret');
            if (!deps.secret || !supplied || !equalSecret(supplied, deps.secret))
                throw new ClockError(401, 'unauthorized');
            const input = workerInput.parse(await request.json());
            if (!deps.deliveryEnabled)
                return clockResponse({
                    enabled: false, processed: 0
                });
            await deps.rpc('enqueue_reminders', {});
            const jobs = z.array(clockJobSchema).parse(await deps.rpc('claim', input));
            const results: {
                id: string;
                success: boolean;
            }[] = [];
            for (const job of jobs) {
                try {
                    if (job.channel === 'email' && !z.array(z.string()).parse(job.payload.flags).some(flag => ['manual_time', 'new_device', 'shared_device', 'repeated_coordinates', 'perfect_accuracy', 'teleport', 'vpn', 'proxy', 'tor'].includes(flag)))
                        throw new ClockError(400, 'email_event_not_allowed');
                    if (job.channel !== 'notification')
                        await deps.deliver(job, {
                            title: job.event_key.startsWith('reminder:') ? reminderTitle(job) : 'Registo de ponto', body: job.event_key.startsWith('reminder:') ? 'Abra o relógio de ponto para registar.' : 'Consulte a sua área de Recursos Humanos para verificar o registo de ponto.', url: '/rh?tab=ponto', idempotencyKey: job.id
                        });
                    await deps.rpc('complete', {
                        id: job.id, claimed_at: job.claimed_at, success: true
                    });
                    results.push({
                        id: job.id, success: true
                    });
                }
                catch (error) {
                    if (!(error instanceof Error))
                        throw error;
                    await deps.rpc('complete', {
                        id: job.id, claimed_at: job.claimed_at, success: false, error: 'delivery_failed'
                    });
                    results.push({
                        id: job.id, success: false
                    });
                }
            }
            return clockResponse({
                enabled: true, processed: results.length, results
            });
        }
        catch (error) {
            return clockFailure(error);
        }
    };
}
