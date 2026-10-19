import { z } from 'npm:zod@3.25.76';
import { equalSecret } from './clock-crypto.ts';
import type { ClockProviders } from './clock-validation.ts';
const networkSchema = z.object({
    proxy: z.enum(['yes', 'no']).optional(), vpn: z.enum(['yes', 'no']).optional(), type: z.string().optional()
});
export function clockHttpProviders(options: {
    readonly fetch: typeof fetch;
    readonly proxyKey: string | undefined;
    readonly ingressSecret: string | undefined;
    readonly now?: () => Date;
}): ClockProviders {
    async function get(url: string, headers: Readonly<Record<string, string>> = {}): Promise<unknown | null> {
        try {
            const response = await options.fetch(url, {
                headers, signal: AbortSignal.timeout(3500)
            });
            if (!response.ok)
                return null;
            return await response.json();
        }
        catch (error) {
            if (error instanceof Error)
                return null;
            throw error;
        }
    }
    return {
        now: options.now ?? (() => new Date()), trustedIp: (request) => {
            const secret = request.headers.get('x-clock-ingress-secret');
            const ip = request.headers.get('x-clock-client-ip');
            if (!options.ingressSecret || !secret || !equalSecret(secret, options.ingressSecret) || !ip || !z.string().ip().safeParse(ip).success)
                return null;
            return ip;
        }, network: async (ip) => {
            if (!options.proxyKey)
                return null;
            const result = await get(`https://proxycheck.io/v2/${encodeURIComponent(ip)}?key=${encodeURIComponent(options.proxyKey)}&vpn=1&asn=1`);
            const parsed = z.object({
                status: z.literal('ok')
            }).passthrough().safeParse(result);
            if (!parsed.success)
                return null;
            const detail = networkSchema.safeParse(parsed.data[ip]);
            if (!detail.success || !detail.data.proxy)
                return null;
            return {
                proxy: detail.data.proxy === 'yes', vpn: detail.data.vpn === 'yes' || detail.data.type === 'VPN', tor: detail.data.type?.toUpperCase() === 'TOR'
            };
        }, address: async (latitude, longitude) => {
            const result = await get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
                'User-Agent': 'Perfect2Gether-Timeclock/1.0', 'Accept-Language': 'pt'
            });
            const parsed = z.object({
                display_name: z.string().max(2000)
            }).safeParse(result);
            return parsed.success ? parsed.data.display_name : null;
        }
    };
}
