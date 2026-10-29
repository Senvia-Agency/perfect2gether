import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { EdpChecklistRule, EdpDraftPayload, EdpSaleContext, EdpSettings } from "@/lib/edp/validation";
import {
  dispatchEdpSale,
  getEdpSaleContext,
  getEdpSettings,
  getEdpSignedUrl,
  saveEdpDraft,
  saveEdpSettings,
  uploadEdpDocument,
  type EdpDocumentUploadInput,
} from "./api";

const SALE_CONTEXT_KEY = "edp-sale-context";
const SETTINGS_KEY = "edp-settings";

export function useEdpSale(saleId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const contextQuery = useQuery({
    queryKey: [SALE_CONTEXT_KEY, saleId],
    queryFn: () => getEdpSaleContext(saleId),
    enabled: enabled && saleId.length > 0,
    staleTime: 15_000,
  });

  const refresh = async (): Promise<EdpSaleContext> => {
    const result = await contextQuery.refetch();
    if (result.error) throw result.error;
    if (!result.data) throw new TypeError("O contexto EDP não foi devolvido.");
    return result.data;
  };

  return {
    contextQuery,
    saveDraft: async (revision: number, payload: EdpDraftPayload) => {
      const saved = await saveEdpDraft(saleId, revision, payload);
      queryClient.setQueryData<EdpSaleContext>([SALE_CONTEXT_KEY, saleId], (current) =>
        current ? { ...current, draft: saved } : current,
      );
      return saved;
    },
    uploadDocument: async (input: EdpDocumentUploadInput) => {
      const uploaded = await uploadEdpDocument(input);
      queryClient.setQueryData<EdpSaleContext>([SALE_CONTEXT_KEY, saleId], (current) => {
        if (!current || current.documents.some((item) => item.version_id === uploaded.version_id)) return current;
        return { ...current, documents: [...current.documents, uploaded] };
      });
      return uploaded;
    },
    downloadDocument: async (versionId: string) => {
      const signed = await getEdpSignedUrl(versionId);
      const link = document.createElement("a");
      link.href = signed.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    },
    dispatchSale: async (revision: number, idempotencyKey: string) => {
      const result = await dispatchEdpSale(saleId, revision, idempotencyKey);
      await queryClient.invalidateQueries({ queryKey: [SALE_CONTEXT_KEY, saleId] });
      return result;
    },
    reloadRevision: async () => (await refresh()).draft?.revision ?? 0,
    refresh,
  };
}

export function useEdpSettings(enabled: boolean) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: getEdpSettings,
    enabled,
    staleTime: 30_000,
  });

  return {
    settingsQuery,
    saveSettings: async (
      revision: number,
      settings: EdpSettings,
      checklist: readonly EdpChecklistRule[],
    ) => {
      const response = await saveEdpSettings(revision, settings, checklist);
      queryClient.setQueryData([SETTINGS_KEY], response);
      await queryClient.invalidateQueries({ queryKey: [SALE_CONTEXT_KEY] });
      return response;
    },
  };
}
