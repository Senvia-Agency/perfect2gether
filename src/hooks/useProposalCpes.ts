import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CpeServiceType } from '@/types/cpes';

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
  commission_group_id: string | null;
  contrato_inicio: string | null;
  contrato_fim: string | null;
  service_type: CpeServiceType | null;
  modalidade: string | null;
  kwp: number | null;
}

export interface ProposalCpeCommissionGroup {
  id: string;
  proposal_id: string;
  total_comissao: number;
  created_at: string;
  updated_at: string;
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
  commission_group_id?: string | null;
  commission_group_key?: string | null;
  contrato_inicio?: string | null;
  contrato_fim?: string | null;
  service_type?: CpeServiceType | null;
  modalidade?: string | null;
  kwp?: number | null;
}

export interface ProposalCpeCommissionGroupInput {
  source_id: string;
  total_comissao: number;
}

export interface ReplaceProposalCpesInput {
  proposalId: string;
  cpes: CreateProposalCpeData[];
  /** Undefined preserves existing group headers; an array replaces them. */
  groups?: ProposalCpeCommissionGroupInput[];
}

function toProposalCpePayload(data: CreateProposalCpeData, proposalId = data.proposal_id) {
  return {
    proposal_id: proposalId,
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
    commission_group_id: data.commission_group_id || null,
    contrato_inicio: data.contrato_inicio || null,
    contrato_fim: data.contrato_fim || null,
    service_type: data.service_type ?? null,
    modalidade: data.modalidade?.trim() || null,
    kwp: data.kwp ?? null,
  };
}

function toReplaceProposalCpePayload(data: CreateProposalCpeData, proposalId: string) {
  return {
    ...toProposalCpePayload(data, proposalId),
    commission_group_key: data.commission_group_key || null,
  };
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

export function useProposalCpeCommissionGroups(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['proposal_cpe_commission_groups', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_cpe_commission_groups')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ProposalCpeCommissionGroup[];
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
        .insert(toProposalCpePayload(data))
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
    mutationFn: async ({ proposalId, cpes, groups = [] }: ReplaceProposalCpesInput) => {
      const { error } = await supabase.rpc('replace_proposal_cpes', {
        p_proposal_id: proposalId,
        p_cpes: cpes.map(cpe => toReplaceProposalCpePayload(cpe, proposalId)),
        p_groups: groups,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal_cpes', variables.proposalId] });
      queryClient.invalidateQueries({ queryKey: ['proposal_cpe_commission_groups', variables.proposalId] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível guardar os CPEs da proposta.', variant: 'destructive' });
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
    mutationFn: async ({ proposalId, cpes, groups }: ReplaceProposalCpesInput) => {
      const { error } = await supabase.rpc('replace_proposal_cpes', {
        p_proposal_id: proposalId,
        p_cpes: cpes.map(cpe => toReplaceProposalCpePayload(cpe, proposalId)),
        ...(groups === undefined ? {} : { p_groups: groups }),
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal_cpes', variables.proposalId] });
      queryClient.invalidateQueries({ queryKey: ['proposal_cpe_commission_groups', variables.proposalId] });
      toast({ title: 'CPEs atualizados', description: 'Os CPEs da proposta foram atualizados.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar os CPEs.', variant: 'destructive' });
    },
  });
}
