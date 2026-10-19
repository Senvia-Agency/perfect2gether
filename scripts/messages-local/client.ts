import { PostgrestClient } from '@supabase/postgrest-js';
import { StorageClient } from '@supabase/storage-js';
import { supabase as account } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const authenticatedFetch: typeof fetch = async (input, init) => {
  const { data, error } = await account.auth.getSession();
  if (error) throw error;
  const headers = new Headers(init?.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const org = localStorage.getItem('p2g_active_organization_id');
  if (org) headers.set('x-p2g-organization', org);
  return fetch(input, { ...init, headers });
};
const rest = new PostgrestClient<Database>(`${window.location.origin}/rest/v1`, { fetch: authenticatedFetch });
export const supabase = {
  rpc: rest.rpc.bind(rest) as typeof rest.rpc,
  storage: new StorageClient(`${window.location.origin}/storage/v1`, {}, authenticatedFetch),
  auth: account.auth,
  channel: account.channel.bind(account),
  removeChannel: account.removeChannel.bind(account),
};
