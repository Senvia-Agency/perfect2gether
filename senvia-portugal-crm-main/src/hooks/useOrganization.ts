import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { FormSettings } from '@/types';
import { Json } from '@/integrations/supabase/types';

// Hook to get current organization data
export function useOrganization() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['organization', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organization.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });
}

interface UpdateOrganizationData {
  name?: string;
  webhook_url?: string | null;
  whatsapp_instance?: string | null;
  whatsapp_api_key?: string | null;
  whatsapp_base_url?: string | null;
  ai_qualification_rules?: string | null;
  form_settings?: Json;
  msg_template_hot?: string | null;
  msg_template_warm?: string | null;
  msg_template_cold?: string | null;
  meta_pixels?: Json;
  brevo_api_key?: string | null;
  brevo_sender_email?: string | null;
  invoicexpress_account_name?: string | null;
  invoicexpress_api_key?: string | null;
  billing_provider?: string;
  keyinvoice_username?: string | null;
  keyinvoice_password?: string | null;
  keyinvoice_company_code?: string | null;
  keyinvoice_api_url?: string | null;
  tax_config?: Json;
  integrations_enabled?: Json;
  sales_settings?: Json;
  commission_matrix?: Json;
  finance_email?: string | null;
  servicos_products_config?: Json;
}

export function useUpdateOrganization() {
  const { organization, refetchUserData } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateOrganizationData) => {
      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      refetchUserData();
      toast({
        title: 'Guardado',
        description: 'Definições atualizadas com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error updating organization:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar as definições.',
        variant: 'destructive',
      });
    },
  });
}

export function useTestWebhook() {
  const { organization } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (webhookUrl: string) => {
      if (!webhookUrl) {
        throw new Error('URL do webhook não definido');
      }

      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      // Fetch real WhatsApp data and AI rules from organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('whatsapp_instance, whatsapp_api_key, whatsapp_base_url, ai_qualification_rules, form_settings, msg_template_hot, msg_template_warm, msg_template_cold')
        .eq('id', organization.id)
        .single();

      if (orgError) {
        console.error('Error fetching org data for webhook test:', orgError);
      }

      // Create a real test lead in the database so n8n can update it
      const testLeadData = {
        organization_id: organization.id,
        name: 'Lead de Teste',
        email: 'teste@exemplo.com',
        phone: '+351912345678',
        source: 'Teste de Webhook',
        status: 'new' as const,
        temperature: 'warm' as const,
        value: 1500,
        notes: 'Mensagem de exemplo do lead - criado por teste de webhook',
        gdpr_consent: true,
      };

      const { data: createdLead, error: createError } = await supabase
        .from('leads')
        .insert(testLeadData)
        .select('id, created_at, updated_at')
        .single();

      if (createError) {
        console.error('Error creating test lead:', createError);
        throw new Error('Não foi possível criar lead de teste');
      }

      // Gerar custom_data dinâmico baseado nos campos personalizados
      const generateTestCustomData = (formSettings: any) => {
        const customData: Record<string, any> = {};
        
        const customFields = formSettings?.custom_fields || [];
        customFields.forEach((field: any) => {
          if (!field.label) return;
          
          switch (field.type) {
            case 'text':
            case 'textarea':
              customData[field.label] = 'Resposta de exemplo';
              break;
            case 'number':
              customData[field.label] = 100;
              break;
            case 'select':
              customData[field.label] = field.options?.[0] || 'Opção de exemplo';
              break;
            case 'checkbox':
              customData[field.label] = true;
              break;
            default:
              customData[field.label] = 'Valor de exemplo';
          }
        });
        
        return customData;
      };

      const testPayload = {
        event: 'lead.created',
        timestamp: new Date().toISOString(),
        meta: {
          is_test: true,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
        config: {
          whatsapp_instance: orgData?.whatsapp_instance || null,
          whatsapp_api_key: orgData?.whatsapp_api_key || null,
          whatsapp_base_url: orgData?.whatsapp_base_url || null,
          ai_qualification_rules: orgData?.ai_qualification_rules || null,
          msg_template_hot: orgData?.msg_template_hot || null,
          msg_template_warm: orgData?.msg_template_warm || null,
          msg_template_cold: orgData?.msg_template_cold || null,
        },
        lead: {
          id: createdLead.id,
          name: testLeadData.name,
          email: testLeadData.email,
          phone: testLeadData.phone,
          source: testLeadData.source,
          status: testLeadData.status,
          temperature: testLeadData.temperature,
          value: testLeadData.value,
          notes: testLeadData.notes,
          gdpr_consent: testLeadData.gdpr_consent,
          custom_data: generateTestCustomData(orgData?.form_settings),
          created_at: createdLead.created_at,
          updated_at: createdLead.updated_at,
        },
        utm: {
          source: 'facebook',
          campaign: 'campanha_teste',
          medium: 'cpc',
          term: null,
          content: null,
        },
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        const isWebhookTest = webhookUrl.includes('/webhook-test/');
        if (response.status === 404 && isWebhookTest) {
          throw new Error('404_WEBHOOK_TEST');
        }
        throw new Error(`Webhook retornou status ${response.status}`);
      }

      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Webhook testado',
        description: 'O webhook respondeu com sucesso! Um lead de teste foi criado no Kanban.',
      });
    },
    onError: (error: Error) => {
      console.error('Webhook test failed:', error);
      
      if (error.message === '404_WEBHOOK_TEST') {
        toast({
          title: 'n8n não está a escutar',
          description: 'O endpoint /webhook-test/ só funciona quando o workflow n8n está em modo Teste. Use a Production URL (/webhook/) para produção.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro no teste',
          description: 'O webhook não respondeu corretamente. Verifique o URL.',
          variant: 'destructive',
        });
      }
    },
  });
}
