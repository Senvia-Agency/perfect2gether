import { supabase } from "@/integrations/supabase/client";
import {
  findValue,
  parseNumericValue,
  normalizeTextValue,
  normalizeIdentifierValue,
} from "@/lib/prospects/import";
import type { TeamMember } from "@/hooks/useTeam";

export interface ClientImportResult {
  inserted: number;
  failed: number;
  errors: string[];
}

export const importClients = async (
  rows: Record<string, unknown>[],
  organizationId: string,
  userId: string,
  teamMembers: TeamMember[],
  onProgress?: (current: number, total: number) => void
): Promise<ClientImportResult> => {
  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = rows.length;

  if (rows.length > 0) {
    console.log("[importClients] Colunas detectadas:", Object.keys(rows[0]));
  }

  for (let i = 0; i < total; i++) {
    const row = rows[i];
    if (onProgress) onProgress(i + 1, total);

    try {
      // 1. Extrair campos
      const dcName = normalizeTextValue(findValue(row, ["DC", "Comercial", "Vendedor"]));
      const companyName = normalizeTextValue(findValue(row, ["Nome da Empresa", "Empresa", "Cliente"]));
      const nifRaw = normalizeIdentifierValue(findValue(row, ["NIPC", "NIF", "VAT"]));
      const nif = nifRaw.replace(/[.\-\s]/g, "");

      const cpeSerial = normalizeIdentifierValue(
        findValue(row, ["Linha de Contrato: Local de Cons", "CPE", "Serial Number", "CPE/CUI"])
      );
      const consumoAnual = parseNumericValue(
        findValue(row, ["Linha de Contrato: Consumo anual", "Consumo Anual", "Consumo"])
      );
      const comercializador = normalizeTextValue(
        findValue(row, ["Comercializador", "Fornecedor"])
      ) || "EDP Comercial";
      const nivelTensao = normalizeTextValue(
        findValue(row, ["Nível Tensão", "Nivel Tensao", "Tensão"])
      ) || null;

      const formatDate = (val: unknown) => {
        if (val instanceof Date) return val.toISOString().split("T")[0];
        return normalizeTextValue(val) || null;
      };
      const fidelizacaoStart = formatDate(findValue(row, ["Data Inicio", "Linha de Contrato: Data de inici", "Start Date"]));
      const fidelizacaoEnd = formatDate(findValue(row, ["Data Fim", "Linha de Contrato: Data Fim de C", "End Date"]));

      if (!companyName) {
        throw new Error(`Nome da empresa é obrigatório. Colunas encontradas: ${Object.keys(row).join(" | ")}`);
      }

      // 2. Resolver consultor
      let consultantId = userId;
      if (dcName) {
        const matched = teamMembers.find(
          (m) => m.full_name.toLowerCase().trim() === dcName.toLowerCase().trim()
        );
        if (matched) consultantId = matched.user_id;
      }

      // 3. Encontrar ou criar cliente (dedup por NIF ou nome)
      let clientId: string | undefined;

      if (nif) {
        const { data: byNif } = await supabase
          .from("crm_clients")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("company_nif", nif)
          .maybeSingle();

        if (byNif) {
          clientId = byNif.id;
          await supabase
            .from("crm_clients")
            .update({ name: companyName, company: companyName, assigned_to: consultantId })
            .eq("id", clientId);
        }
      }

      if (!clientId) {
        const { data: byName } = await supabase
          .from("crm_clients")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("company", companyName)
          .maybeSingle();

        if (byName) {
          clientId = byName.id;
          await supabase
            .from("crm_clients")
            .update({ company_nif: nif || null, assigned_to: consultantId })
            .eq("id", clientId);
        }
      }

      if (!clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from("crm_clients")
          .insert({
            organization_id: organizationId,
            name: companyName,
            company: companyName,
            company_nif: nif || null,
            billing_target: "company",
            assigned_to: consultantId,
            status: "active",
            source: "import",
          })
          .select("id")
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      // 4. Criar ou atualizar CPE no cliente
      if (cpeSerial) {
        const { data: existingCpe } = await supabase
          .from("cpes")
          .select("id")
          .eq("client_id", clientId)
          .eq("serial_number", cpeSerial)
          .maybeSingle();

        if (existingCpe) {
          await supabase
            .from("cpes")
            .update({
              consumo_anual: consumoAnual || null,
              comercializador,
              fidelizacao_start: fidelizacaoStart,
              fidelizacao_end: fidelizacaoEnd,
              nivel_tensao: nivelTensao as any,
            })
            .eq("id", existingCpe.id);
        } else {
          await supabase.from("cpes").insert({
            client_id: clientId,
            organization_id: organizationId,
            equipment_type: "Energia",
            serial_number: cpeSerial,
            status: "active",
            comercializador,
            consumo_anual: consumoAnual || null,
            fidelizacao_start: fidelizacaoStart,
            fidelizacao_end: fidelizacaoEnd,
            nivel_tensao: nivelTensao as any,
          });
        }
      }

      inserted++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Erro na linha "${findValue(row, ["Nome da Empresa", "Empresa", "Cliente"])}": ${msg}`);
    }
  }

  return { inserted, failed, errors };
};
