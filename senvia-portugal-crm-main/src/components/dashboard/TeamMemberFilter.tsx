import { useMemo } from "react";
import { useTeamMembers } from "@/hooks/useTeam";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface TeamMemberFilterProps {
  className?: string;
}

export function TeamMemberFilter({ className }: TeamMemberFilterProps) {
  const { canFilterByTeam, selectedMemberId, setSelectedMemberId, isTeamLeader, teamMemberIds, currentUserId } = useTeamFilter();
  const { data: allMembers = [] } = useTeamMembers();

  // For leaders: show only their team members + themselves
  // For admins: show all members
  const visibleMembers = useMemo(() => {
    if (!isTeamLeader) return allMembers; // admin sees all
    // Leader sees self + team members
    const allowedIds = new Set([currentUserId, ...teamMemberIds].filter(Boolean));
    return allMembers.filter(m => allowedIds.has(m.user_id));
  }, [allMembers, isTeamLeader, teamMemberIds, currentUserId]);

  if (!canFilterByTeam) return null;

  return (
    <Select 
      value={selectedMemberId || "all"} 
      onValueChange={(v) => setSelectedMemberId(v === "all" ? null : v)}
    >
      <SelectTrigger className={className || "w-[180px]"}>
        <Users className="h-4 w-4 mr-2 shrink-0" />
        <SelectValue placeholder={isTeamLeader ? "Minha equipa" : "Todos os colaboradores"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{isTeamLeader ? "Minha equipa" : "Todos os colaboradores"}</SelectItem>
        {visibleMembers.map((m) => (
          <SelectItem key={m.id} value={m.user_id}>
            {m.full_name}
            {m.user_id === currentUserId ? " (eu)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
