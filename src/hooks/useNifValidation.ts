import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseNifValidationProps {
  nif: string;
  organizationId: string | undefined;
  excludeClientId?: string;
}

interface NifValidationResult {
  isDuplicate: boolean;
  existingClientName: string | null;
  existingClientCode: string | null;
}

export function useNifValidation({
  nif,
  organizationId,
  excludeClientId,
}: UseNifValidationProps): NifValidationResult {
  const [debouncedNif, setDebouncedNif] = useState(nif);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNif(nif.trim()), 300);
    return () => clearTimeout(timer);
  }, [nif]);

  const { data } = useQuery({
    queryKey: ["nif-validation", debouncedNif, organizationId, excludeClientId],
    queryFn: async () => {
      if (!debouncedNif || !organizationId) return null;

      // RPC security-definer: verifica o NIF em TODA a organização. Uma query
      // direta a crm_clients seria limitada pelo RLS aos clientes do próprio
      // utilizador, deixando passar duplicados de colegas.
      const { data, error } = await (supabase as any).rpc("check_nif_exists", {
        p_nif: debouncedNif,
        p_exclude_client_id: excludeClientId ?? null,
      });
      if (error) throw error;
      return (data as Array<{ id: string; name: string; code: string }> | null)?.[0] || null;
    },
    enabled: !!debouncedNif && debouncedNif.length >= 5 && !!organizationId,
  });

  return {
    isDuplicate: !!data,
    existingClientName: data?.name || null,
    existingClientCode: data?.code || null,
  };
}
