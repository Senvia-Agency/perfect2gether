import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import {
  parseClientDocumentArchive,
  parseClientDocumentPeople,
} from '@/lib/client-documents';
import { EdpArchiveDocumentResponseSchema } from '@/lib/edp/validation';
import {
  uploadEdpDocument,
  type EdpDocumentUploadInput,
} from '@/modules/edp/api';

const clientDocumentKey = (clientId: string) => ['client-documents', clientId] as const;

export function useClientDocuments(clientId: string) {
  return useQuery({
    queryKey: clientDocumentKey(clientId),
    queryFn: async () => {
      const [documents, versions, people] = await Promise.all([
        supabase
          .from('client_documents')
          .select('id,client_id,person_id,category,label,archived_at,created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('client_document_versions')
          .select('id,document_id,side,original_name,mime_type,size_bytes,sha256,validity_suggested_on,validity_confirmed_on,created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('client_people')
          .select('id,name')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true }),
      ]);

      if (documents.error) throw documents.error;
      if (versions.error) throw versions.error;
      if (people.error) throw people.error;
      return {
        documents: parseClientDocumentArchive(documents.data, versions.data, people.data),
        people: parseClientDocumentPeople(people.data),
      };
    },
  });
}

export function useUploadClientDocument(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<EdpDocumentUploadInput, 'clientId'>) =>
      uploadEdpDocument({ ...input, clientId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientDocumentKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: ['edp-sale-context'] }),
      ]);
    },
  });
}

export function useArchiveClientDocument(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.rpc('edp_archive_document', {
        p_document_id: documentId,
      });
      if (error) throw error;
      return EdpArchiveDocumentResponseSchema.parse(data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientDocumentKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: ['edp-sale-context'] }),
      ]);
    },
  });
}
