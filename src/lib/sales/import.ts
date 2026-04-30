import { supabase } from "@/integrations/supabase/client";
import {
  findValue,
  parseNumericValue,
  normalizeTextValue,
  normalizeIdentifierValue
} from "@/lib/prospects/import";
import type { TeamMember } from "@/hooks/useTeam";

export interface SaleImportResult {
  inserted: number;
  failed: number;
  errors: string[];
}

export const importSales = async (
  rows: Record<string, unknown>[],
  organizationId: string,
  userId: string,
  teamMembers: TeamMember[],
  onProgress?: (current: number, total: number) => void
): Promise<SaleImportResult> => {
  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = rows.length;

  if (rows.length > 0) {
    console.log("[import] Colunas detectadas:", Object.keys(rows[0]));
  }

  for (let i = 0; i < total; i++) {
    const row = rows[i];
    if (onProgress) onProgress(i + 1, total);

    try {
      // 1. Extract values
      const dcName = normalizeTextValue(findValue(row, ["DC", "Comercial", "Vendedor"]));
      const companyName = normalizeTextValue(findValue(row, ["Nome da Empresa", "Empresa", "Cliente"]));
      // NIF always stored/searched in clean format (no dots, dashes, spaces)
      const nifRaw = normalizeIdentifierValue(findValue(row, ["NIPC", "NIF", "VAT"]));
      const nif = nifRaw.replace(/[.\-\s]/g, "");
      const oppType = normalizeTextValue(findValue(row, ["Tipo de registro de oportunidade", "Oportunidade"]));
      const typeRaw = normalizeTextValue(findValue(row, ["Tipo", "Módulo"]));

      const negotiationType = (() => {
        const t = typeRaw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (t.includes("indexado")) return "angariacao_indexado";
        if (t.includes("renov")) return "renovacao";
        if (t.includes("angari")) return "angariacao";
        if (t.includes("sem volume") || t.includes("semvolume")) return "sem_volume";
        return null;
      })() as "angariacao" | "angariacao_indexado" | "renovacao" | "sem_volume" | null;

      const cpe = normalizeIdentifierValue(findValue(row, ["Linha de Contrato: Local de Cons", "CPE", "Serial Number"]));
      const consumption = parseNumericValue(findValue(row, ["Linha de Contrato: Consumo anual", "Consumo Anual"]));

      const formatImportDate = (val: unknown) => {
        if (val instanceof Date) return val.toISOString().split("T")[0];
        return normalizeTextValue(val);
      };

      const startDate = formatImportDate(findValue(row, ["Linha de Contrato: Data de inici", "Data Inicio", "Start Date"]));
      const endDate = formatImportDate(findValue(row, ["Linha de Contrato: Data Fim de C", "Data Fim", "End Date"]));
      const totalValue = parseNumericValue(findValue(row, ["Valor de Venda", "Valor Venda", "Valor", "Total", "Venda"]));
      const paymentMethod = normalizeTextValue(findValue(row, ["Modalidade Pagamento", "Pagamento"]));
      const kwp = parseNumericValue(findValue(row, ["KWP", "Kilowatt Peak"]));

      if (!companyName) {
        throw new Error(`Nome da empresa é obrigatório. Colunas encontradas: ${Object.keys(row).join(" | ")}`);
      }

      // 2. Find or match consultant
      let consultantId = userId;
      if (dcName) {
        const matched = teamMembers.find(m =>
          m.full_name.toLowerCase().trim() === dcName.toLowerCase().trim()
        );
        if (matched) consultantId = matched.user_id;
      }

      // 3. Find or create client — deduplicate by NIF first, then by company name
      let clientId: string | undefined;

      if (nif) {
        // Two separate .eq() queries — avoids .or() PostgREST parsing issues with dotted values
        const { data: existingByNif } = await supabase
          .from("crm_clients")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("company_nif", nif)
          .maybeSingle();

        if (existingByNif) {
          clientId = existingByNif.id;
          await supabase.from("crm_clients").update({
            name: companyName,
            company: companyName,
            company_nif: nif,
            billing_target: "company",
            assigned_to: consultantId,
          }).eq("id", clientId);
        }
      }

      if (!clientId) {
        const { data: existingByName } = await supabase
          .from("crm_clients")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("company", companyName)
          .maybeSingle();

        if (existingByName) {
          clientId = existingByName.id;
          await supabase.from("crm_clients").update({
            company_nif: nif || null,
            billing_target: "company",
            assigned_to: consultantId,
          }).eq("id", clientId);
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

      // 4. Deduplicate proposal by CPE serial number (if present)
      if (cpe) {
        const { data: existingCpe } = await supabase
          .from("proposal_cpes")
          .select("id, proposal_id")
          .eq("serial_number", cpe)
          .maybeSingle();

        if (existingCpe?.proposal_id) {
          await supabase.from("proposals").update({
            total_value: totalValue || 0,
            negotiation_type: negotiationType,
            notes: `Importado (Atualizado): ${oppType} | ${typeRaw} | Pagamento: ${paymentMethod}`,
          }).eq("id", existingCpe.proposal_id);

          await supabase.from("proposal_cpes").update({
            consumo_anual: consumption,
            contrato_inicio: startDate || null,
            contrato_fim: endDate || null,
          }).eq("id", existingCpe.id);

          inserted++;
          continue;
        }
      }

      // 5. Create Proposal (status: sent = em aberto)
      const proposalType = kwp && kwp > 0 ? "servicos" : "energia";

      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .insert({
          organization_id: organizationId,
          client_id: clientId,
          created_by: consultantId,
          proposal_type: proposalType,
          negotiation_type: negotiationType,
          status: "sent",
          total_value: totalValue || 0,
          consumo_anual: consumption,
          kwp: kwp,
          proposal_date: new Date().toISOString().split("T")[0],
          notes: `Importado: ${oppType} | ${typeRaw} | Pagamento: ${paymentMethod}`,
        })
        .select("id")
        .single();

      if (proposalError) throw proposalError;

      // 6. Create CPE on proposal (and on client if new)
      if (cpe) {
        const { error: cpeError } = await supabase
          .from("proposal_cpes")
          .insert({
            proposal_id: proposal.id,
            serial_number: cpe,
            equipment_type: "Energia",
            comercializador: "EDP Comercial",
            consumo_anual: consumption,
            contrato_inicio: startDate || null,
            contrato_fim: endDate || null,
          });

        if (cpeError) throw cpeError;

        const { data: clientCpe } = await supabase
          .from("cpes")
          .select("id")
          .eq("client_id", clientId)
          .eq("serial_number", cpe)
          .maybeSingle();

        if (!clientCpe) {
          await supabase.from("cpes").insert({
            client_id: clientId,
            organization_id: organizationId,
            equipment_type: "Energia",
            serial_number: cpe,
            status: "active",
            comercializador: "EDP Comercial",
            fidelizacao_start: startDate || null,
            fidelizacao_end: endDate || null,
          });
        }
      }

      inserted++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Erro na linha "${findValue(row, ["Nome da Empresa"])}": ${msg}`);
    }
  }

  return { inserted, failed, errors };
};
