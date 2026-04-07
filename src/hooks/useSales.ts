import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { toast } from "sonner";
import type { SaleStatus, SaleWithDetails, PaymentMethod, PaymentStatus, ProposalType, ModeloServico, NegotiationType } from "@/types/sales";

export function useSales() {
  const { organization } = useAuth();
  const { effectiveUserIds } = useTeamFilter();

  return useQuery({
    queryKey: ["sales", organization?.id, effectiveUserIds],
    queryFn: async (): Promise<SaleWithDetails[]> => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          lead:leads(name, email, phone, assigned_to),
          proposal:proposals(id, code, proposal_date),
          client:crm_clients(id, name, code, email, phone, company, nif, address_line1, address_line2, city, postal_code, country)
        `)
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      let result = (data as unknown as SaleWithDetails[]) || [];
      
      // Filter by user IDs (admin/leader/single user)
      if (effectiveUserIds) {
        result = result.filter(sale => 
          (sale.created_by && effectiveUserIds.includes(sale.created_by)) || 
          (sale.lead?.assigned_to && effectiveUserIds.includes(sale.lead.assigned_to))
        );
      }
      
      return result;
    },
    enabled: !!organization?.id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { organization, user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      proposal_id?: string;
      lead_id?: string;
      client_id?: string;
      status?: SaleStatus;
      total_value: number;
      subtotal?: number;
      discount?: number;
      payment_method?: PaymentMethod;
      payment_status?: PaymentStatus;
      due_date?: string;
      invoice_reference?: string;
      sale_date?: string;
      notes?: string;
      // Campos específicos de proposta
      proposal_type?: ProposalType;
      consumo_anual?: number;
      margem?: number;
      dbl?: number;
      anos_contrato?: number;
      modelo_servico?: ModeloServico;
      kwp?: number;
      comissao?: number;
      negotiation_type?: NegotiationType;
      servicos_produtos?: string[];
      servicos_details?: Record<string, any>;
      edp_proposal_number?: string;
      client_org_id?: string;
      // Campos de recorrência
      has_recurring?: boolean;
      recurring_value?: number;
      recurring_status?: 'active' | 'cancelled' | 'paused' | 'pending' | 'pending';
      next_renewal_date?: string;
      activation_date?: string;
    }) => {
      if (!organization?.id) throw new Error("Sem organização");

      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          organization_id: organization.id,
          proposal_id: data.proposal_id || null,
          lead_id: data.lead_id || null,
          client_id: data.client_id || null,
          total_value: data.total_value,
          subtotal: data.subtotal || data.total_value,
          discount: data.discount || 0,
          payment_method: data.payment_method || null,
          payment_status: data.payment_status || "pending",
          due_date: data.due_date || null,
          invoice_reference: data.invoice_reference || null,
          sale_date: data.sale_date || new Date().toISOString().split('T')[0],
          notes: data.notes || null,
          created_by: user?.id || null,
          status: data.status || "pending",
          // Campos específicos de proposta
          proposal_type: data.proposal_type || null,
          consumo_anual: data.consumo_anual || null,
          margem: data.margem || null,
          dbl: data.dbl || null,
          anos_contrato: data.anos_contrato || null,
          modelo_servico: data.modelo_servico || null,
          kwp: data.kwp || null,
          comissao: data.comissao || null,
          negotiation_type: data.negotiation_type || null,
          servicos_produtos: data.servicos_produtos || null,
          servicos_details: data.servicos_details || null,
          edp_proposal_number: data.edp_proposal_number || null,
          client_org_id: (data as any).client_org_id || null,
          // Campos de recorrência
          has_recurring: data.has_recurring || false,
          recurring_value: data.recurring_value || 0,
          recurring_status: data.recurring_status || 'active',
          next_renewal_date: data.next_renewal_date || null,
          activation_date: data.activation_date || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Se activation_date preenchida, criar registo no histórico
      if (data.activation_date && sale?.id) {
        await (supabase as any)
          .from('sale_activation_history')
          .insert({
            sale_id: sale.id,
            organization_id: organization.id,
            activation_date: data.activation_date,
            changed_by: user?.id || null,
            notes: `Definida na criação da venda (estado: ${data.status || 'pending'})`,
          });
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-sales"] });
      queryClient.invalidateQueries({ queryKey: ["commissions-live"] });
      toast.success("Venda criada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao criar venda");
    },
  });
}

export function useCreateSaleFromProposal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (proposal: {
      id: string;
      organization_id: string;
      lead_id: string | null;
      client_id?: string | null;
      total_value: number;
    }) => {
      // Check if sale already exists for this proposal
      const { data: existingSale } = await supabase
        .from("sales")
        .select("id")
        .eq("proposal_id", proposal.id)
        .single();

      if (existingSale) {
        return { ...existingSale, alreadyExists: true }; // Sale already exists, don't create duplicate
      }

      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          organization_id: proposal.organization_id,
          proposal_id: proposal.id,
          lead_id: proposal.lead_id || null,
          client_id: proposal.client_id || null,
          total_value: proposal.total_value,
          subtotal: proposal.total_value,
          created_by: user?.id || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return sale;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["commissions-live"] });
      if (!(data as any).alreadyExists) {
        toast.success("Proposta aceite! Venda criada automaticamente.");
      }
    },
    onError: () => {
      toast.error("Erro ao criar venda");
    },
  });
}

export function useUpdateSaleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: SaleStatus }) => {
      const { error } = await supabase
        .from("sales")
        .update({ status })
        .eq("id", saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["commissions-live"] });
      toast.success("Estado atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar estado");
    },
  });
}

export function useUpdateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      saleId, 
      updates 
    }: { 
      saleId: string; 
      updates: { 
        status?: SaleStatus; 
        notes?: string; 
        total_value?: number;
        payment_method?: PaymentMethod | null;
        payment_status?: PaymentStatus;
        due_date?: string | null;
        paid_date?: string | null;
        invoice_reference?: string | null;
        discount?: number;
        subtotal?: number;
        client_id?: string | null;
        sale_date?: string;
        proposal_type?: ProposalType | null;
        consumo_anual?: number | null;
        margem?: number | null;
        dbl?: number | null;
        anos_contrato?: number | null;
        modelo_servico?: ModeloServico | null;
        kwp?: number | null;
        comissao?: number | null;
        negotiation_type?: string | null;
        servicos_produtos?: string[] | null;
        servicos_details?: Record<string, any> | null;
        edp_proposal_number?: string | null;
        // Campos de recorrência
        has_recurring?: boolean;
        recurring_value?: number;
        next_renewal_date?: string | null;
        recurring_status?: 'active' | 'cancelled' |'pending' |  'paused' | null;
        // Data de ativação
        activation_date?: string | null;
      }
    }) => {
      const { error } = await supabase
        .from("sales")
        .update(updates)
        .eq("id", saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-sales"] });
      queryClient.invalidateQueries({ queryKey: ["commissions-live"] });
    },
    onError: () => {
      toast.error("Erro ao atualizar venda");
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["commissions-live"] });
      toast.success("Venda eliminada!");
    },
    onError: () => {
      toast.error("Erro ao eliminar venda");
    },
  });
}
