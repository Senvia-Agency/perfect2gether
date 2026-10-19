import { z } from 'npm:zod@3.25.76';
import { ClockError, clockFailure, clockResponse } from '../_shared/clock-contract.ts';
import { sha256, toHex } from '../_shared/clock-crypto.ts';
export const manageTagSchema = z.object({
    org: z.string().uuid(), op: z.enum(['create', 'rotate', 'disable']), id: z.string().uuid().optional(), location_id: z.string().uuid().optional(), name: z.string().trim().min(1).max(100).optional(), kind: z.enum(['static', 'ntag424']).optional(), uid_hex: z.string().regex(/^[a-f\d]{14}$/i).optional(), reason: z.string().trim().min(3).max(2000)
}).strict();
export type ClockTagDependencies = {
    readonly authenticate: (request: Request) => Promise<string>;
    readonly manage: (org: string, actor: string, input: Readonly<Record<string, unknown>>) => Promise<unknown>;
    readonly random?: (length: number) => Uint8Array<ArrayBuffer>;
};
export function createClockTagHandler(deps: ClockTagDependencies): (request: Request) => Promise<Response> {
    return async (request) => {
        if (request.method === 'OPTIONS')
            return clockResponse({});
        if (request.method !== 'POST')
            return clockResponse({
                error: 'method_not_allowed'
            }, 405);
        try {
            const actor = await deps.authenticate(request);
            const input = manageTagSchema.parse(await request.json());
            if (input.op !== 'create' && !input.id)
                throw new ClockError(400, 'tag_id_required');
            if (input.op === 'create' && (!input.location_id || !input.name || !input.kind))
                throw new ClockError(400, 'tag_fields_required');
            if (input.op !== 'disable' && input.kind === 'ntag424' && !input.uid_hex)
                throw new ClockError(400, 'uid_required');
            const random = deps.random ?? (length => crypto.getRandomValues(new Uint8Array(length)));
            const token = input.op === 'disable' ? null : toHex(random(32));
            const aesKey = input.op === 'disable' ? null : toHex(random(16));
            const result = await deps.manage(input.org, actor, {
                ...input, ...(token ? {
                    token_hash: await sha256(token), aes_key: aesKey
                } : {})
            });
            const safe = z.object({
                id: z.string(), location_id: z.string(), name: z.string(), kind: z.enum(['static', 'ntag424']), is_active: z.boolean(), last_counter: z.number()
            }).parse(result);
            return clockResponse({
                tag: safe, ...(token ? {
                    token, ...(safe.kind === 'ntag424' ? {
                        aes_key: aesKey, profile: 'encrypted_picc_empty_mac_same_key'
                    } : {})
                } : {})
            });
        }
        catch (error) {
            return clockFailure(error);
        }
    };
}
