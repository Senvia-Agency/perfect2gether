import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { absenceTypeLabels } from "@/lib/rh-utils";
import type { OverlappingAbsence } from "@/hooks/useRhAbsences";

interface Props {
  overlaps: OverlappingAbsence[];
}

export default function RhOverlapWarning({ overlaps }: Props) {
  if (overlaps.length === 0) return null;

  return (
    <div className="px-3 py-2 text-xs rounded-md bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 flex items-start gap-2">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">Sobreposições na equipa:</span>
        <ul className="mt-0.5 space-y-0.5">
          {overlaps.map((o, i) => (
            <li key={i}>
              <span className="font-semibold">{o.userName}</span>
              {" — "}
              {absenceTypeLabels[o.absenceType] || o.absenceType}
              {" ("}
              {o.status === "approved" ? "aprovado" : "pendente"}
              {") "}
              {o.periods.map((p, j) => (
                <span key={j}>
                  {format(new Date(p.startDate), "dd MMM", { locale: pt })}
                  {p.startDate !== p.endDate && ` - ${format(new Date(p.endDate), "dd MMM", { locale: pt })}`}
                  {j < o.periods.length - 1 ? ", " : ""}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
