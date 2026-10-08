import type { RhSnapshot } from "./schema";
export function teamOverlapUsers(
  data: Pick<RhSnapshot, "calendar">,
  userId: string,
  periods: readonly {
    readonly start_date?: string;
    readonly end_date?: string;
  }[],
): readonly string[] {
  return [
    ...new Set(
      data.calendar
        .filter(
          (a) =>
            a.user_id !== userId &&
            !["cancelled", "rejected"].includes(a.status) &&
            a.periods.some(
              (p) =>
                ["approved", "pending"].includes(p.status) &&
                periods.some(
                  (q) =>
                    q.start_date &&
                    q.end_date &&
                    p.start_date <= q.end_date &&
                    p.end_date >= q.start_date,
                ),
            ),
        )
        .map((a) => a.user_id),
    ),
  ];
}
