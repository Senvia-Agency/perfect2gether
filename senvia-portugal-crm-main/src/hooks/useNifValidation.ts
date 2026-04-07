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

      let query = supabase
        .from("crm_clients")
        .select("id, name, code")
        .eq("organization_id", organizationId)
        .or(`nif.eq.${debouncedNif},company_nif.eq.${debouncedNif}`)
        .limit(1);

      if (excludeClientId) {
        query = query.neq("id", excludeClientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!debouncedNif && debouncedNif.length >= 5 && !!organizationId,
  });

  return {
    isDuplicate: !!data,
    existingClientName: data?.name || null,
    existingClientCode: data?.code || null,
  };
}
