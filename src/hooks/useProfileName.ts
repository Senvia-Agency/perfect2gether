import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Nome de um utilizador (ex.: quem criou uma lead ou cliente)
export function useProfileName(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-name', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId!)
        .maybeSingle();
      return data?.full_name ?? null;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}
