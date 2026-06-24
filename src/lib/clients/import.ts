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

      // Datas: NAO usar toISOString(). A libraria de Excel cria a data a meia-noite
      // LOCAL; toISOString() converte para UTC e, com offset positivo (Portugal UTC+1
      // no verao), recua 1 dia -> 21/06 virava 20/06. Usamos os componentes locais.
      // Aceita tambem texto em DD/MM/AAAA (ou DD-MM-AAAA) e ISO AAAA-MM-DD.
      const formatDate = (val: unknown): string | null => {
        if (val instanceof Date && !isNaN(val.getTime())) {
          const y = val.getFullYear();
          const m = String(val.getMonth() + 1).padStart(2, "0");
          const d = String(val.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        const s = normalizeTextValue(val);
        if (!s) return null;
        const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
        if (dmy) {
          const dd = dmy[1].padStart(2, "0");
          const mm = dmy[2].padStart(2, "0");
          const yyyy = dmy[3].length === 2 ? "20" + dmy[3] : dmy[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        return null; // formato desconhecido: melhor null do que data errada
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

      // 4. Criar CPE para ESTA linha.
      //    Decisao: cada linha do ficheiro = um registo proprio (mesmo que o numero
      //    de CPE se repita). As linhas de "Oportunidade de Servicos" ficam com
      //    equipment_type 'Servicos' (em vez de 'Energia'), para se distinguirem.
      //    NOTA: nao deduplica -> reimportar o mesmo ficheiro cria duplicados.
      if (cpeSerial) {
        const tipoOportunidade = normalizeTextValue(
          findValue(row, ["Tipo de Oportunidade", "Tipo Oportunidade", "Oportunidade", "Tipo", "Produto", "Familia", "Família"])
        );
        let equipmentType: string;
        if (tipoOportunidade) {
          equipmentType = /servi[cç]/i.test(tipoOportunidade) ? "Serviços" : "Energia";
        } else {
          // Sem coluna de tipo: heuristica — linhas de servico vem sem consumo nem datas.
          equipmentType = (!consumoAnual && !fidelizacaoStart && !fidelizacaoEnd) ? "Serviços" : "Energia";
        }

        const { error: cpeError } = await supabase.from("cpes").insert({
          client_id: clientId,
          organization_id: organizationId,
          equipment_type: equipmentType,
          serial_number: cpeSerial,
          status: "active",
          comercializador,
          consumo_anual: consumoAnual || null,
          fidelizacao_start: fidelizacaoStart,
          fidelizacao_end: fidelizacaoEnd,
          nivel_tensao: nivelTensao as any,
        });
        if (cpeError) throw cpeError;
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
