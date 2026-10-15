import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getCpeSaveError } from '@/lib/cpe-errors';
import type { CpeStatus, CpeServiceType } from '@/types/cpes';

interface CreateCpeData {
  readonly client_id: string;
  readonly equipment_type: string;
  readonly serial_number?: string;
  readonly comercializador: string;
  readonly fidelizacao_start?: string;
  readonly fidelizacao_end?: string;
  readonly status?: CpeStatus;
  readonly nivel_tensao?: string;
  readonly notes?: string;
  readonly consumo_anual?: number;
  readonly service_type?: CpeServiceType;
  readonly modalidade?: string;
  readonly kwp?: number;
}

export function useCreateCpe() {
  const { organization } = useAuth();
  const organizationId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCpeData) => {
      if (!organizationId) throw new Error('No organization');

      const { data: cpe, error } = await supabase
        .from('cpes')
        .insert({
          ...data,
          organization_id: organizationId,
          status: data.status || 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return cpe;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cpes'] });
      toast.success('CPE adicionado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating CPE:', error);
      toast.error(getCpeSaveError(error, 'Erro ao adicionar CPE'));
    },
  });
}

