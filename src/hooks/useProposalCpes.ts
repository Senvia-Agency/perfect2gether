import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProposalCpe {
  id: string;
  proposal_id: string;
  existing_cpe_id: string | null;
  equipment_type: string;
  serial_number: string | null;
  comercializador: string;
  fidelizacao_start: string | null;
  fidelizacao_end: string | null;
  notes: string | null;
  created_at: string;
  // Campos de energia por CPE
  consumo_anual: number | null;
  duracao_contrato: number | null;
  dbl: number | null;
  margem: number | null;
  comissao: number | null;
  contrato_inicio: string | null;
  contrato_fim: string | null;
}

export interface CreateProposalCpeData {
  proposal_id: string;
  existing_cpe_id?: string | null;
  equipment_type: string;
  serial_number?: string | null;
  comercializador: string;
  fidelizacao_start?: string | null;
  fidelizacao_end?: string | null;
  notes?: string | null;
  // Campos de energia por CPE
  consumo_anual?: number | null;
  duracao_contrato?: number | null;
  dbl?: number | null;
  margem?: number | null;
  comissao?: number | null;
  contrato_inicio?: string | null;
  contrato_fim?: string | null;
}

export function useProposalCpes(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['proposal_cpes', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_cpes')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ProposalCpe[];
    },
    enabled: !!proposalId,
  });
}

export function useCreateProposalCpe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateProposalCpeData) => {
      const { data: result, error } = await supabase
        .from('proposal_cpes')
        .insert({
          proposal_id: data.proposal_id,
          existing_cpe_id: data.existing_cpe_id || null,
          equipment_type: data.equipment_type,
          serial_number: data.serial_number || null,
          comercializador: data.comercializador,
          fidelizacao_start: data.fidelizacao_start || null,
          fidelizacao_end: data.fidelizacao_end || null,
          notes: data.notes || null,
          consumo_anual: data.consumo_anual ?? null,
          duracao_contrato: data.duracao_contrato ?? null,
          dbl: data.dbl ?? null,
          margem: data.margem ?? null,
          comissao: data.comissao ?? null,
          contrato_inicio: data.contrato_inicio || null,
          contrato_fim: data.contrato_fim || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal_cpes', variables.proposal_id] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível adicionar o CPE.', variant: 'destructive' });
    },
  });
}

export function useCreateProposalCpesBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (cpesData: CreateProposalCpeData[]) => {
      if (cpesData.length === 0) return [];
      
      const { data: result, error } = await supabase
        .from('proposal_cpes')
        .insert(cpesData.map(cpe => ({
          proposal_id: cpe.proposal_id,
          existing_cpe_id: cpe.existing_cpe_id || null,
          equipment_type: cpe.equipment_type,
          serial_number: cpe.serial_number || null,
          comercializador: cpe.comercializador,
          fidelizacao_start: cpe.fidelizacao_start || null,
          fidelizacao_end: cpe.fidelizacao_end || null,
          notes: cpe.notes || null,
          consumo_anual: cpe.consumo_anual ?? null,
          duracao_contrato: cpe.duracao_contrato ?? null,
          dbl: cpe.dbl ?? null,
          margem: cpe.margem ?? null,
          comissao: cpe.comissao ?? null,
          contrato_inicio: cpe.contrato_inicio || null,
          contrato_fim: cpe.contrato_fim || null,
        })))
        .select();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['proposal_cpes', variables[0].proposal_id] });
      }
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível adicionar os CPEs.', variant: 'destructive' });
    },
  });
}

export function useDeleteProposalCpe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, proposalId }: { id: string; proposalId: string }) => {
      const { error } = await supabase
        .from('proposal_cpes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return proposalId;
    },
    onSuccess: (proposalId) => {
      queryClient.invalidateQueries({ queryKey: ['proposal_cpes', proposalId] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível remover o CPE.', variant: 'destructive' });
    },
  });
}

export function useUpdateProposalCpes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ proposalId, cpes }: { proposalId: string; cpes: CreateProposalCpeData[] }) => {
      // 1. Delete existing CPEs for this proposal
      const { error: deleteError } = await supabase
        .from('proposal_cpes')
        .delete()
        .eq('proposal_id', proposalId);
      
      if (deleteError) throw deleteError;
      
      // 2. Insert new CPEs if any
      if (cpes.length > 0) {
        const { data: result, error: insertError } = await supabase
          .from('proposal_cpes')
          .insert(cpes.map(cpe => ({
            proposal_id: proposalId,
            existing_cpe_id: cpe.existing_cpe_id || null,
            equipment_type: cpe.equipment_type,
            serial_number: cpe.serial_number || null,
            comercializador: cpe.comercializador,
            fidelizacao_start: cpe.fidelizacao_start || null,
            fidelizacao_end: cpe.fidelizacao_end || null,
            notes: cpe.notes || null,
            consumo_anual: cpe.consumo_anual ?? null,
            duracao_contrato: cpe.duracao_contrato ?? null,
            dbl: cpe.dbl ?? null,
            margem: cpe.margem ?? null,
            comissao: cpe.comissao ?? null,
            contrato_inicio: cpe.contrato_inicio || null,
            contrato_fim: cpe.contrato_fim || null,
          })))
          .select();
        
        if (insertError) throw insertError;
        return result;
      }
      
      return [];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal_cpes', variables.proposalId] });
      toast({ title: 'CPEs atualizados', description: 'Os CPEs da proposta foram atualizados.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar os CPEs.', variant: 'destructive' });
    },
  });
}
