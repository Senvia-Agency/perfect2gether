import { useTeamOverlappingAbsences } from "@/hooks/useRhAbsences";
import type { RhAbsence } from "@/hooks/useRhAbsences";
import type { DatePeriod } from "@/lib/rh-utils";
import RhOverlapWarning from "./RhOverlapWarning";

interface Props {
  absence: RhAbsence;
  organizationId: string | undefined;
}

export default function RhAdminOverlapCheck({ absence, organizationId }: Props) {
  // Convert absence periods to DatePeriod format for the hook
  const periods: DatePeriod[] = (absence.rh_absence_periods || []).map(p => ({
    from: new Date(p.start_date),
    to: new Date(p.end_date),
    periodType: p.period_type as "full_day" | "partial",
  }));

  const { data: overlaps = [] } = useTeamOverlappingAbsences(
    absence.user_id,
    periods,
    organizationId
  );

  if (overlaps.length === 0) return null;

  return <div className="mb-1"><RhOverlapWarning overlaps={overlaps} /></div>;
}
