import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseCertificateHistory, type ClientCertificateHistoryRow } from '@/lib/client-certificate';
import { parseClientPersonRoleRows, type ClientPersonRolePayload, type ClientPersonRoleRow } from '@/lib/decision-makers';
import type { Json } from '@/integrations/supabase/types';
import type { ClientStatus } from '@/types/clients';

class ClientDataContractError extends Error {
  constructor(readonly operation: string) {
    super(`Resposta inválida ao ${operation}.`);
    this.name = 'ClientDataContractError';
  }
}

export function compactClientPatch(entries: Readonly<Record<string, Json | undefined>>): Record<string, Json> {
  const result: Record<string, Json> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function clientPeoplePayloadJson(people: readonly ClientPersonRolePayload[]): Json {
  return people.map(person => compactClientPatch({
    id: person.id,
    name: person.name,
    nif: person.nif,
    phone: person.phone,
    email: person.email,
    source: person.source,
    source_ref: person.source_ref,
    source_metadata: person.source_metadata,
    roles: [...person.roles],
    role_sources: person.role_sources,
  }));
}

export function parseClientMutationResult(value: Json | null, operation: string): { readonly id: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ClientDataContractError(operation);
  }
  const client = value.client;
  if (!client || typeof client !== 'object' || Array.isArray(client) || typeof client.id !== 'string') {
    throw new ClientDataContractError(operation);
  }
  return { id: client.id };
}

function isRevisionConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === '40001';
}

export type ClientPeoplePatch = {
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly company: string | null;
  readonly company_nif: string | null;
  readonly crc_code: string | null;
  readonly certificate_data: Json | null;
  readonly certificate_checked_at: string | null;
  readonly billing_target: 'client' | 'company';
  readonly status: ClientStatus;
  readonly source: string | null;
  readonly notes: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly city: string | null;
  readonly postal_code: string | null;
  readonly country: string | null;
  readonly distrito: string | null;
  readonly conselho: string | null;
  readonly grupo_economico: string | null;
  readonly assigned_to?: string | null;
};

function updateClientPatch(data: ClientPeoplePatch): Json {
  return compactClientPatch({
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company,
    company_nif: data.company_nif,
    crc_code: data.crc_code,
    certificate_data: data.certificate_data,
    certificate_checked_at: data.certificate_checked_at,
    billing_target: data.billing_target,
    status: data.status,
    source: data.source,
    notes: data.notes,
    address_line1: data.address_line1,
    address_line2: data.address_line2,
    city: data.city,
    postal_code: data.postal_code,
    country: data.country,
    distrito: data.distrito,
    conselho: data.conselho,
    grupo_economico: data.grupo_economico,
    assigned_to: data.assigned_to,
  });
}

export function useClientPeopleRoles(clientId: string | null) {
  return useQuery<ClientPersonRoleRow[]>({
    queryKey: ['client-people-roles', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_people_roles')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return parseClientPersonRoleRows(data);
    },
    enabled: !!clientId,
  });
}

export function useSaveClientPeopleRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, expectedUpdatedAt, patch, people }: {
      readonly clientId: string;
      readonly expectedUpdatedAt: string;
      readonly patch: ClientPeoplePatch;
      readonly people: readonly ClientPersonRolePayload[];
    }) => {
      const { data, error } = await supabase.rpc('save_client_people_roles', {
        p_client_id: clientId,
        p_expected_updated_at: expectedUpdatedAt,
        p_client_patch: updateClientPatch(patch),
        p_people: clientPeoplePayloadJson(people),
      });
      if (error) throw error;
      return parseClientMutationResult(data, 'guardar o cliente');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-client', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-people-roles', variables.clientId] });
      toast.success('Cliente atualizado');
    },
    onError: (error) => {
      if (isRevisionConflict(error)) {
        toast.error('A ficha foi alterada por outra pessoa. Reabra e reveja os dados antes de guardar.');
        return;
      }
      console.error('Error saving client people:', error);
      toast.error('Erro ao atualizar cliente');
    },
  });
}

export function useClientCertificateHistory(clientId: string | null) {
  return useQuery<ClientCertificateHistoryRow[]>({
    queryKey: ['client-certificate-history', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_certificate_history')
        .select('*')
        .eq('client_id', clientId)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return parseCertificateHistory(data);
    },
    enabled: !!clientId,
  });
}

export function useRenewClientCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, expectedCurrentVersionId, crcCode, certificateData, validFrom, validUntil, sourceMetadata }: {
      readonly clientId: string;
      readonly expectedCurrentVersionId: string | null;
      readonly crcCode: string | null;
      readonly certificateData: Json;
      readonly validFrom: string | null;
      readonly validUntil: string;
      readonly sourceMetadata: Json;
    }) => {
      const { data, error } = await supabase.rpc('renew_client_certificate', {
        p_client_id: clientId,
        p_expected_current_version_id: expectedCurrentVersionId,
        p_crc_code: crcCode,
        p_certificate_data: certificateData,
        p_valid_from: validFrom,
        p_valid_until: validUntil,
        p_source: 'manual',
        p_source_metadata: sourceMetadata,
      });
      if (error) throw error;
      if (!data?.id) throw new ClientDataContractError('renovar a certidão');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-client', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-certificate-history', variables.clientId] });
      toast.success('CRC renovado e versão anterior preservada');
    },
    onError: (error) => {
      if (isRevisionConflict(error)) {
        toast.error('A certidão atual mudou. Reabra a renovação e reveja a nova versão.');
        return;
      }
      console.error('Error renewing client certificate:', error);
      toast.error('Erro ao renovar CRC');
    },
  });
}
