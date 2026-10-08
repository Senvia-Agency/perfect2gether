import { memberName } from "@/lib/rh/form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceEditor } from "./BalanceEditor";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

export function VacationBalances({
  data,
  workspace,
  year,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly year: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldos anuais · {year}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Férias e quotas por colaborador
            </caption>
            <thead>
              <tr>
                {[
                  "Colaborador",
                  "Total",
                  "Usado",
                  "Pendente",
                  "Disponível total",
                  "Quota própria",
                  "Reserva empresa",
                  "Disponível próprio",
                  "Disponível empresa",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap p-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.balances
                .filter((b) => b.year === year)
                .map((b) => (
                  <tr key={b.user_id} className="border-t">
                    <td className="p-2">{memberName(data, b.user_id)}</td>
                    {[
                      b.total_days,
                      b.used_days,
                      b.pending_days,
                      b.total_days - b.used_days - b.pending_days,
                      b.total_days - b.company_reserved_days,
                      b.company_reserved_days,
                      b.personal_available_days ?? 0,
                      b.company_available_days ?? 0,
                    ].map((n, i) => (
                      <td key={i} className="p-2">
                        {n.toLocaleString("pt-PT")} d
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!data.balances.some((b) => b.year === year) && (
          <p className="text-sm text-muted-foreground">
            O saldo anual é inicializado ao primeiro pedido; pode ser definido
            pelo gestor.
          </p>
        )}
        {data.permissions["balances.manage"] && (
          <BalanceEditor
            key={year}
            data={data}
            workspace={workspace}
            year={year}
          />
        )}
      </CardContent>
    </Card>
  );
}
