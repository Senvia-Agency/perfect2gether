import { useMutation } from '@tanstack/react-query';
import { invokeFunction } from '@/lib/invokeFunction';
import { toast } from 'sonner';

interface ProductItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SendProposalEmailData {
  organizationId: string;
  to: string;
  clientName: string;
  proposalCode: string;
  proposalDate: string;
  totalValue: number;
  products: ProductItem[];
  notes?: string;
  orgName: string;
  logoUrl?: string;
}

export function useSendProposalEmail() {
  return useMutation({
    mutationFn: async (data: SendProposalEmailData) => {
      return await invokeFunction('send-proposal-email', data);
    },
    onSuccess: () => {
      toast.success('Email enviado com sucesso!', {
        description: 'A proposta foi enviada para o cliente.',
      });
    },
    onError: (error: Error) => {
      console.error('Error sending proposal email:', error);
      toast.error('Erro ao enviar email', {
        description: error.message || 'Não foi possível enviar a proposta por email.',
      });
    },
  });
}
