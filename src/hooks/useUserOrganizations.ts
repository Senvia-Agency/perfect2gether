import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types';

export interface UserOrganization {
  organization_id: string;
  organization_name: string;
  organization_code: string;
  organization_slug: string;
  member_role: AppRole;
  is_active: boolean;
}

export function useUserOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: async (): Promise<UserOrganization[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .rpc('get_user_organizations', { _user_id: user.id });

      if (error) {
        console.error('Error fetching user organizations:', error);
        throw error;
      }

      return (data || []) as UserOrganization[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
