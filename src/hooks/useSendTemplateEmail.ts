import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/lib/invokeFunction';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Recipient {
  email: string;
  name: string;
  clientId?: string;
  variables?: Record<string, string>;
}

interface SendTemplateRequest {
  templateId?: string;
  recipients: Recipient[];
  campaignId?: string;
  settings?: Record<string, boolean>;
  settingsData?: Record<string, string>;
  subject?: string;
  htmlContent?: string;
}

interface SendTemplateResponse {
  success: boolean;
  summary: {
    total: number;
    sent: number;
    failed: number;
  };
  results: Array<{
    email: string;
    status: string;
    error?: string;
  }>;
}

export function useSendTemplateEmail() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, recipients, campaignId, settings, settingsData, subject, htmlContent }: SendTemplateRequest): Promise<SendTemplateResponse> => {
      if (!organization?.id) throw new Error('Sem organização');

      return await invokeFunction<SendTemplateResponse>('send-template-email', {
        organizationId: organization.id,
        templateId: templateId || undefined,
        recipients,
        campaignId,
        settings,
        settingsData,
        subject,
        htmlContent,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-sends'] });
      
      if (data.summary.failed === 0) {
        toast.success(`Email enviado para ${data.summary.sent} destinatário(s)`);
      } else if (data.summary.sent > 0) {
        toast.warning(`${data.summary.sent} enviado(s), ${data.summary.failed} falhou/falharam`);
      } else {
        toast.error('Falha ao enviar emails');
      }
    },
    onError: (error) => {
      console.error('Error sending template:', error);
      toast.error('Erro ao enviar email');
    },
  });
}
