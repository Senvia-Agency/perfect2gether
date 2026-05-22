import { useTeamMembers } from "@/hooks/useTeam";
import { useTeamFilter, useTeamScopedMembers } from "@/hooks/useTeamFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface TeamMemberFilterProps {
  className?: string;
}

export function TeamMemberFilter({ className }: TeamMemberFilterProps) {
  const { selectedMemberId, setSelectedMemberId, currentUserId } = useTeamFilter();
  const { data: allMembers = [] } = useTeamMembers({ excludeAdmins: true });
  // Escopo dos membros e rótulo "todos" — partilhado com ClientFilters / Agenda.
  const { members, canFilterByTeam, allOptionLabel } = useTeamScopedMembers(allMembers);

  if (!canFilterByTeam) return null;

  return (
    <Select
      value={selectedMemberId || "all"}
      onValueChange={(v) => setSelectedMemberId(v === "all" ? null : v)}
    >
      <SelectTrigger className={className || "w-[180px]"}>
        <Users className="h-4 w-4 mr-2 shrink-0" />
        <SelectValue placeholder={allOptionLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allOptionLabel}</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.user_id}>
            {m.full_name}
            {m.user_id === currentUserId ? " (eu)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
