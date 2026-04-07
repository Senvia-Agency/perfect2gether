import { useIsMobile } from "@/hooks/use-mobile";
import { KanbanBoard } from "./KanbanBoard";
import { KanbanTabs } from "./KanbanTabs";
import { Lead, LeadTemperature } from "@/types";
import { useLeadEvents } from "@/hooks/useLeadEvents";

interface ResponsiveKanbanProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: string) => void;
  onTemperatureChange: (leadId: string, newTemperature: LeadTemperature) => void;
  onViewDetails: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
}

export function ResponsiveKanban(props: ResponsiveKanbanProps) {
  const isMobile = useIsMobile();
  const { data: leadEvents = {} } = useLeadEvents();

  if (isMobile) {
    return <KanbanTabs {...props} leadEvents={leadEvents} />;
  }

  return <KanbanBoard {...props} leadEvents={leadEvents} />;
}
