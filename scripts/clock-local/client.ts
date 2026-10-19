import { PostgrestClient } from '@supabase/postgrest-js';
import { FunctionsClient } from '@supabase/functions-js';
import { supabase as account } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
const authenticatedFetch: typeof fetch = async (input, init) => {
  const { data, error } = await account.auth.getSession();
  if (error) throw error;
  const headers = new Headers(init?.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const org = localStorage.getItem('p2g_active_organization_id');
  if (org) headers.set('x-p2g-organization', org);
  return fetch(input, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(20000) });
};
const base = `${window.location.origin}/__p2g-clock`;
const rest = new PostgrestClient<Database>(`${base}/rest/v1`, { fetch: authenticatedFetch });
export const supabase = { rpc: rest.rpc.bind(rest), functions: new FunctionsClient(`${base}/functions/v1`, { customFetch: authenticatedFetch }) };
