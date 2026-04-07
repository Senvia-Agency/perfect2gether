import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface LeadAttachment {
  id: string;
  organization_id: string;
  lead_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useLeadAttachments(leadId: string | null | undefined) {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['lead-attachments', leadId],
    queryFn: async () => {
      if (!leadId || !organization?.id) return [];
      const { data, error } = await supabase
        .from('lead_attachments')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadAttachment[];
    },
    enabled: !!leadId && !!organization?.id,
  });
}

export function useUploadLeadAttachment() {
  const queryClient = useQueryClient();
  const { organization, user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, file }: { leadId: string; file: File }) => {
      if (!organization?.id) throw new Error('Sem organização');

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${organization.id}/leads/${leadId}/${timestamp}-${safeName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(path, file);
      if (uploadError) throw uploadError;

      // Insert metadata
      const { data, error } = await supabase
        .from('lead_attachments')
        .insert({
          organization_id: organization.id,
          lead_id: leadId,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-attachments', variables.leadId] });
      toast({ title: 'Ficheiro anexado com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao anexar ficheiro', variant: 'destructive' });
    },
  });
}

export function useDeleteLeadAttachment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (attachment: LeadAttachment) => {
      // Delete from storage
      await supabase.storage.from('invoices').remove([attachment.file_path]);
      // Delete metadata
      const { error } = await supabase
        .from('lead_attachments')
        .delete()
        .eq('id', attachment.id);
      if (error) throw error;
      return attachment;
    },
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({ queryKey: ['lead-attachments', attachment.lead_id] });
      toast({ title: 'Ficheiro removido' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover ficheiro', variant: 'destructive' });
    },
  });
}

export async function getAttachmentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error('Erro ao gerar link');
  return data.signedUrl;
}
