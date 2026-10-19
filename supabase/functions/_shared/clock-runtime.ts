import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { requireUser, RequestAccessError } from './organization-request-auth.ts';
import { ClockError } from './clock-contract.ts';
import { clockDatabaseError } from './clock-errors.ts';
export function clockRuntime() {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !service)
        throw new ClockError(503, 'configuration_missing');
    const db = createClient(url, service, {
        auth: {
            persistSession: false, autoRefreshToken: false
        }
    });
    return {
        db, url, service, authenticate: async (request: Request): Promise<string> => {
            try {
                return await requireUser(db, request);
            }
            catch (error) {
                if (error instanceof RequestAccessError)
                    throw new ClockError(error.status, error.status === 401 ? 'unauthorized' : 'mfa_or_access_required');
                throw error;
            }
        }, rpc: async (name: string, input: Readonly<Record<string, unknown>>): Promise<unknown> => {
            const { data, error } = await db.rpc(name, input);
            if (error)
                throw clockDatabaseError(error);
            return data;
        }
    };
}
