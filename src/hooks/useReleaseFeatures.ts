import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({ messages: z.boolean(), timeclock: z.boolean(), new_ui: z.boolean(), can_manage: z.boolean() });
export type ReleaseFeatures = z.infer<typeof schema>;
type ReleaseUpdate = Omit<ReleaseFeatures, 'can_manage'>;
const unavailable: ReleaseFeatures = { messages: false, timeclock: false, new_ui: false, can_manage: false };
export function useReleaseFeatures() {
  const { user, organization } = useAuth();
  const client = useQueryClient();
  const org = organization?.id ?? '';
  const queryKey = ['release-features', org, user?.id] as const;
  const query = useQuery({ queryKey, enabled: !!org && !!user, staleTime: 15000, refetchInterval: 30000, retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('p2g_release', { action: 'snapshot', payload: { org } });
      if (error) {
        if (import.meta.env.DEV && ['PGRST202', '42883'].includes(error.code)) return { messages: true, timeclock: true, new_ui: true, can_manage: false };
        throw error;
      }
      return schema.parse(data);
    },
  });
  const update = useMutation({ mutationFn: async (values: ReleaseUpdate) => {
    const { data, error } = await supabase.rpc('p2g_release', { action: 'update', payload: { org, ...values } });
    if (error) throw error;
    return schema.parse(data);
  }, onSuccess: async data => {
    client.setQueryData(queryKey, data);
    await client.invalidateQueries({ queryKey: ['release-features', org] });
  } });
  return { ...query, features: query.data ?? unavailable, update };
}
