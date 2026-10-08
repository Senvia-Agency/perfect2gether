import type { RhSnapshot } from "@/lib/rh/schema";
import { teamOverlapUsers } from "@/lib/rh/calendar";
import { memberName } from "@/lib/rh/form";
export function TeamOverlapWarning({
  data,
  userId,
  periods,
}: {
  readonly data: RhSnapshot;
  readonly userId: string;
  readonly periods: readonly {
    readonly start_date?: string;
    readonly end_date?: string;
  }[];
}) {
  const users = teamOverlapUsers(data, userId, periods);
  return users.length ? (
    <p
      role="status"
      className="rounded-md border border-border bg-muted p-3 text-sm"
    >
      Há colegas ausentes neste intervalo:{" "}
      {users.map((id) => memberName(data, id)).join(", ")}. Verifique a
      disponibilidade da equipa antes de confirmar.
    </p>
  ) : null;
}
