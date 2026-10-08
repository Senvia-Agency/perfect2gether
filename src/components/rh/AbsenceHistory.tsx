import type { RhSnapshot } from "@/lib/rh/schema";
import { statusLabels } from "@/lib/rh/schema";
const actions: Readonly<Record<string, string>> = {
  create: "Pedido criado",
  edit: "Remarcado",
  approve: "Aprovado",
  partial: "Aprovado parcialmente",
  reject: "Rejeitado",
  cancel: "Cancelado",
  withdraw: "Aprovação retirada",
};
export function AbsenceHistory({
  data,
  id,
}: {
  readonly data: RhSnapshot;
  readonly id: string;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer">Histórico</summary>
      {data.history
        .filter((h) => h.absence_id === id)
        .map((h) => (
          <div key={h.id} className="mt-3 space-y-2 rounded-md border p-3">
            <p>
              {new Date(h.created_at).toLocaleString("pt-PT")} ·{" "}
              {actions[h.action] ?? "Alteração"} · {h.actor_name || "Gestor RH"}
              {h.reason && ` · ${h.reason}`}
            </p>
            {h.before_data && (
              <details>
                <summary className="cursor-pointer">
                  Ver períodos antes e depois
                </summary>
                {[
                  ["Antes", h.before_data],
                  ["Depois", h.after_data],
                ].map(([label, snapshot]) => {
                  if (typeof snapshot === "string" || !snapshot) return null;
                  return (
                    <div key={String(label)} className="mt-2">
                      <p className="font-medium">
                        {String(label)} · {statusLabels[snapshot.status]}
                      </p>
                      {snapshot.periods.map((p) => (
                        <p key={p.id}>
                          {p.start_date} → {p.end_date}
                          {p.period_type !== "full_day" &&
                            ` · ${p.start_time}–${p.end_time}`}{" "}
                          · {p.business_days} dias úteis ·{" "}
                          {statusLabels[p.status]}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </details>
            )}
          </div>
        ))}
    </details>
  );
}
