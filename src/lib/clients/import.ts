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
      const comercializadorRaw = normalizeTextValue(
        findValue(row, ["Comercializador", "Fornecedor"])
      );
      const comercializador = comercializadorRaw || "EDP Comercial";
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

      // 4. ENERGIA -> CPE 'Energia' (upsert por cliente+CPE; atualiza, nunca duplica).
      //    SERVICOS -> CPE 'Servicos', UM POR LINHA (nao junta), com o valor nas notas.
      //    Dedup dos servicos por (cliente+CPE+'Servicos'+nota/valor): linhas com
      //    valores diferentes ficam distintas; reimportar atualiza, nunca duplica.
      if (cpeSerial) {
        const tipoOportunidade = normalizeTextValue(
          findValue(row, ["Tipo de Oportunidade", "Tipo Oportunidade", "Oportunidade", "Tipo", "Produto", "Familia", "Família"])
        );
        const isServico = tipoOportunidade
          ? /servi[cç]/i.test(tipoOportunidade)
          : (!consumoAnual && !fidelizacaoStart && !fidelizacaoEnd);

        if (isServico) {
          // Valor da venda de servicos: tentar pelo nome da coluna; senao, a coluna
          // logo a seguir a "Data Fim" (layout do ficheiro de origem).
          let valorCell = findValue(row, [
            "Valor", "Montante", "Valor Venda", "Valor do Contrato", "Valor Anual",
            "Receita", "MRR", "Total", "Linha de Contrato: Valor",
          ]);
          if (!normalizeTextValue(valorCell)) {
            const rowKeys = Object.keys(row);
            const dataFimKey = rowKeys.find((k) => /data\s*fim|fim de c|end date/i.test(k));
            if (dataFimKey) valorCell = row[rowKeys[rowKeys.indexOf(dataFimKey) + 1]];
          }
          const valorStr = normalizeTextValue(valorCell);
          const noteText = valorStr ? `Serviço: ${valorStr}` : `Serviço (linha ${i + 1})`;

          const { data: existingServ } = await supabase
            .from("cpes")
            .select("id")
            .eq("client_id", clientId)
            .eq("serial_number", cpeSerial)
            .eq("equipment_type", "Serviços")
            .eq("notes", noteText)
            .maybeSingle();

          if (!existingServ) {
            const { error: insErr } = await supabase.from("cpes").insert({
              client_id: clientId,
              organization_id: organizationId,
              equipment_type: "Serviços",
              serial_number: cpeSerial,
              status: "active",
              comercializador,
              notes: noteText,
              consumo_anual: null,
              fidelizacao_start: null,
              fidelizacao_end: null,
              nivel_tensao: nivelTensao as any,
            });
            if (insErr) throw insErr;
          }
          // se ja existe (mesmo valor) -> nada a fazer (nao duplica).
        } else {
          // ENERGIA -> upsert por (cliente, numero de CPE, 'Energia').
          const { data: existingCpe } = await supabase
            .from("cpes")
            .select("id")
            .eq("client_id", clientId)
            .eq("serial_number", cpeSerial)
            .eq("equipment_type", "Energia")
            .maybeSingle();

          if (existingCpe) {
            // Atualizar SEM sobrescrever valores existentes com vazios.
            const updateData: Record<string, unknown> = {};
            if (consumoAnual) updateData.consumo_anual = consumoAnual;
            if (comercializadorRaw) updateData.comercializador = comercializadorRaw;
            if (fidelizacaoStart) updateData.fidelizacao_start = fidelizacaoStart;
            if (fidelizacaoEnd) updateData.fidelizacao_end = fidelizacaoEnd;
            if (nivelTensao) updateData.nivel_tensao = nivelTensao;
            if (Object.keys(updateData).length > 0) {
              const { error: updErr } = await supabase.from("cpes").update(updateData).eq("id", existingCpe.id);
              if (updErr) throw updErr;
            }
          } else {
            const { error: insErr } = await supabase.from("cpes").insert({
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
            if (insErr) throw insErr;
          }
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
