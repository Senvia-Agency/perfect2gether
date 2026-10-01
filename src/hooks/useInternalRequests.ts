import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { InternalRequest, InternalRequestAttachment, RequestType, RequestStatus } from '@/types/internal-requests';

const BUCKET = 'internal-requests';

interface Filters {
  type?: RequestType;
  status?: RequestStatus;
}

// Files go in the uploader's folder (required by the bucket INSERT policy)
async function uploadAttachments(organizationId: string, userId: string, requestId: string, files: File[]) {
  for (const [index, file] of files.entries()) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${requestId}/${Date.now()}-${index}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
    if (uploadError) throw uploadError;
    const { error } = await supabase.from('internal_request_attachments' as any).insert({
      organization_id: organizationId,
      request_id: requestId,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || null,
      uploaded_by: userId,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
  }
}

export function useInternalRequests(filters?: Filters) {
  const { session, organization } = useAuth();
  const organizationId = organization?.id;
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['internal-requests', organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from('internal_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .order('submitted_at', { ascending: false });

      if (filters?.type) query = query.eq('request_type', filters.type);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch submitter names
      const userIds = [...new Set((data || []).map(r => r.submitted_by))];
      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
        }
      }

      return (data || []).map(r => ({
        ...r,
        submitter: profilesMap[r.submitted_by] || undefined,
      })) as InternalRequest[];
    },
    enabled: !!organizationId && !!session,
  });

  const submitRequest = useMutation({
    mutationFn: async ({ files = [], ...input }: {
      request_type: RequestType;
      title: string;
      description?: string;
      amount?: number;
      expense_date?: string;
      period_start?: string;
      period_end?: string;
      files?: File[];
    }) => {
      if (!organizationId || !session?.user.id) throw new Error('Sem sessão');
      const { data, error } = await supabase
        .from('internal_requests')
        .insert({
          organization_id: organizationId,
          submitted_by: session.user.id,
          ...input,
        })
        .select('id')
        .single();
      if (error) throw error;

      let uploadFailed = false;
      if (files.length > 0) {
        try {
          await uploadAttachments(organizationId, session.user.id, data.id, files);
        } catch {
          uploadFailed = true;
        }
      }
      return { input, uploadFailed };
    },
    onSuccess: ({ input, uploadFailed }) => {
      if (uploadFailed) {
        toast.warning('Pedido submetido, mas alguns documentos não foram anexados. Pode adicioná-los no detalhe do pedido.');
      } else {
        toast.success('Pedido submetido com sucesso');
      }
      queryClient.invalidateQueries({ queryKey: ['internal-requests'] });
      // Notify finance email silently
      supabase.functions.invoke('notify-finance-request', {
        body: {
          organization_id: organizationId,
          title: input.title,
          request_type: input.request_type,
        },
      }).catch(() => {});
    },
    onError: () => toast.error('Erro ao submeter pedido'),
  });

  const reviewRequest = useMutation({
    mutationFn: async (input: {
      id: string;
      status: 'approved' | 'rejected' | 'paid';
      review_notes?: string;
      payment_reference?: string;
    }) => {
      if (!session?.user.id) throw new Error('Sem sessão');
      const updateData: Record<string, unknown> = {
        status: input.status,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: input.review_notes || null,
      };
      if (input.status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        updateData.payment_reference = input.payment_reference || null;
      }
      const { error } = await supabase
        .from('internal_requests')
        .update(updateData)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const labels = { approved: 'aprovado', rejected: 'rejeitado', paid: 'marcado como pago' };
      toast.success(`Pedido ${labels[vars.status]}`);
      queryClient.invalidateQueries({ queryKey: ['internal-requests'] });
      // Notify submitter via email
      if (['approved', 'rejected', 'paid'].includes(vars.status)) {
        supabase.functions.invoke('notify-request-status', {
          body: {
            request_id: vars.id,
            organization_id: organizationId,
            new_status: vars.status,
            review_notes: vars.review_notes,
          },
        }).catch(() => {});
      }
    },
    onError: () => toast.error('Erro ao processar pedido'),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      // Files first: the storage DELETE policy authorizes through the attachment rows
      const { data: attachments } = await supabase
        .from('internal_request_attachments' as any)
        .select('file_path')
        .eq('request_id', id);
      const paths = ((attachments || []) as unknown as { file_path: string }[]).map(a => a.file_path);
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);

      const { data, error } = await supabase.from('internal_requests').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Sem permissão para eliminar este pedido');
    },
    onSuccess: () => {
      toast.success('Pedido eliminado');
      queryClient.invalidateQueries({ queryKey: ['internal-requests'] });
    },
    onError: () => toast.error('Erro ao eliminar pedido'),
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return {
    requests,
    isLoading,
    submitRequest,
    reviewRequest,
    deleteRequest,
    pendingCount,
  };
}

export function useInternalRequestAttachments(requestId: string | null | undefined) {
  const { session, organization } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['internal-request-attachments', requestId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_request_attachments' as any)
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as InternalRequestAttachment[];
    },
    enabled: !!requestId && !!session,
  });

  const addAttachments = useMutation({
    mutationFn: async (files: File[]) => {
      if (!requestId || !organization?.id || !session?.user.id) throw new Error('Sem sessão');
      await uploadAttachments(organization.id, session.user.id, requestId, files);
    },
    onSuccess: () => toast.success('Documentos anexados'),
    onError: () => toast.error('Erro ao anexar documentos'),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeAttachment = useMutation({
    mutationFn: async (attachment: InternalRequestAttachment) => {
      await supabase.storage.from(BUCKET).remove([attachment.file_path]);
      const { data, error } = await supabase
        .from('internal_request_attachments' as any)
        .delete()
        .eq('id', attachment.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Sem permissão para eliminar este documento');
    },
    onSuccess: () => toast.success('Documento eliminado'),
    onError: () => toast.error('Erro ao eliminar documento'),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { attachments, isLoading, addAttachments, removeAttachment };
}

// The bucket is private, so documents open through a short-lived signed URL
export async function openInternalRequestFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error('Erro ao gerar link');
  window.open(data.signedUrl, '_blank');
}
