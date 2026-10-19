import { z } from 'npm:zod@3.25.76';
export const positionSchema = z.object({
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().nonnegative().max(100000), age_ms: z.number().nonnegative().max(86400000)
}).strict();
export const punchSchema = z.object({
    org: z.string().uuid(), request_id: z.string().uuid(), action: z.enum(['start', 'pause', 'resume', 'stop']), position: positionSchema.nullable(), device_id: z.string().min(8).max(200), note: z.string().trim().max(300).optional(), at: z.string().datetime({
        offset: true
    }).optional(), tag: z.object({
        id: z.string().uuid(), token: z.string().max(200).optional(), counter: z.number().int().nonnegative().max(0xffffff).optional(), picc_data: z.string().regex(/^[a-f\d]{32}$/i).optional(), cmac: z.string().regex(/^[a-f\d]{16}$/i).optional()
    }).strict().optional()
}).strict();
export const locationSchema = z.object({
    id: z.string().uuid(), name: z.string(), latitude: z.number(), longitude: z.number(), radius_m: z.number().positive(), max_accuracy_m: z.number().positive(), gps_only: z.boolean(), block_vpn: z.boolean(), trusted_ips: z.array(z.string()).default([]), is_active: z.boolean()
});
export const tagSchema = z.object({
    id: z.string().uuid(), location_id: z.string().uuid(), kind: z.enum(['static', 'ntag424']), token_hash: z.string().nullable(), aes_key: z.string().nullable(), uid_hex: z.string().nullable(), last_counter: z.number(), is_active: z.boolean()
});
export const previousSchema = z.object({
    user_id: z.string().optional(), punched_at: z.string(), device_id: z.string().nullable().optional(), latitude: z.number().nullable().optional(), longitude: z.number().nullable().optional(), position: positionSchema.nullable().optional(), metadata: z.record(z.unknown()).optional(), status: z.string().optional()
}).passthrough();
export const contextSchema = z.object({
    duplicate: z.object({
        entry: z.unknown(), duplicate: z.literal(true)
    }).nullable().optional(), locations: z.array(locationSchema), tags: z.array(tagSchema), previous: z.array(previousSchema).default([]), devices: z.array(z.object({
        user_id: z.string(), device_id: z.string()
    })).default([])
});
export type Punch = z.infer<typeof punchSchema>;
export type ClockContext = z.infer<typeof contextSchema>;
export type ClockLocation = z.infer<typeof locationSchema>;
export type Decision = {
    readonly status: 'valid' | 'flagged' | 'pending';
    readonly flags: readonly string[];
    readonly source: 'gps' | 'nfc';
    readonly location_id: string | null;
    readonly location_name: string | null;
    readonly address: string | null;
    readonly distance_m: number | null;
    readonly metadata: Readonly<Record<string, unknown>>;
};
export class ClockError extends Error {
    constructor(readonly status: number, readonly code: string) {
        super(code);
        this.name = 'ClockError';
    }
}
export const cors = {
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store'
};
export function clockResponse(data: unknown, status = 200): Response {
    return Response.json(data, {
        status, headers: cors
    });
}
export function clockFailure(error: unknown): Response {
    if (error instanceof ClockError)
        return clockResponse({
            error: error.code, code: error.code, message: error.code === 'invalid_state' ? 'O estado do ponto mudou. Atualize e tente novamente.' : error.code === 'invalid_manual_time' ? 'A hora manual deve ser de hoje e estar nas últimas 12 horas.' : error.code === 'network_blocked' ? 'Esta rede não é permitida neste local.' : error.code.includes('nfc') ? 'A etiqueta NFC não é válida ou já foi utilizada.' : 'Não foi possível concluir a operação de ponto.'
        }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
        return clockResponse({
            error: 'invalid_request'
        }, 400);
    return clockResponse({
        error: 'service_unavailable'
    }, 503);
}
