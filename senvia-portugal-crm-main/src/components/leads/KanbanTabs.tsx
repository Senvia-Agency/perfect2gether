import { Badge } from "@/components/ui/badge";
import { LeadCard } from "./LeadCard";
import { Lead, LeadTemperature } from "@/types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePipelineStages, PipelineStage } from "@/hooks/usePipelineStages";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

interface LeadEvent {
  id: string;
  title: string;
  start_time: string;
  event_type: string;
}

interface KanbanTabsProps {
  leads: Lead[];
  leadEvents?: Record<string, LeadEvent>;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onTemperatureChange: (leadId: string, newTemperature: LeadTemperature) => void;
  onViewDetails: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
}

// Helper to generate badge style from hex color
const getBadgeStyle = (hexColor: string) => {
  return {
    backgroundColor: `${hexColor}20`,
    color: hexColor,
  };
};

// Helper to generate dot color class from hex
const getDotStyle = (hexColor: string) => ({
  backgroundColor: hexColor,
});

export function KanbanTabs({
  leads,
  leadEvents = {},
  onStatusChange,
  onTemperatureChange,
  onViewDetails,
  onDelete,
}: KanbanTabsProps) {
  const { data: stages = [], isLoading } = usePipelineStages();
  const { isAdmin } = usePermissions();
  const [activeStatus, setActiveStatus] = useState<string>("");

  // Set initial active status when stages load
  useEffect(() => {
    if (stages.length > 0 && !activeStatus) {
      setActiveStatus(stages[0].key);
    }
  }, [stages, activeStatus]);

  const isFinalStatus = (status: string) => {
    const stage = stages.find(s => s.key === status);
    return stage?.is_final_positive || stage?.is_final_negative || false;
  };

  const getLeadsByStatus = (statusKey: string) => {
    return leads.filter((lead) => lead.status === statusKey);
  };

  // Get orphan leads (leads with status not in current pipeline)
  const getOrphanLeads = () => {
    const stageKeys = stages.map(s => s.key);
    return leads.filter((lead) => !stageKeys.includes(lead.status || ''));
  };

  const orphanLeads = getOrphanLeads();
  const filteredLeads = activeStatus === '__orphan__' 
    ? orphanLeads 
    : getLeadsByStatus(activeStatus);

  const activeStage = stages.find(s => s.key === activeStatus);

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Pipeline não configurado</p>
        <p className="text-xs mt-1">Configure o pipeline nas Definições</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Status Selector */}
      <Select value={activeStatus} onValueChange={setActiveStatus}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {activeStatus === '__orphan__' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span>Sem Etapa</span>
                <Badge variant="secondary" className="ml-auto bg-muted text-muted-foreground">
                  {orphanLeads.length}
                </Badge>
              </>
            ) : activeStage ? (
              <>
                <span 
                  className="h-2 w-2 rounded-full" 
                  style={getDotStyle(activeStage.color)} 
                />
                <span>{activeStage.name}</span>
                <Badge 
                  variant="secondary" 
                  className="ml-auto"
                  style={getBadgeStyle(activeStage.color)}
                >
                  {getLeadsByStatus(activeStatus).length}
                </Badge>
              </>
            ) : (
              <SelectValue placeholder="Selecionar etapa" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {stages.map((stage) => {
            const count = getLeadsByStatus(stage.key).length;
            return (
              <SelectItem key={stage.id} value={stage.key}>
                <div className="flex items-center gap-2">
                  <span 
                    className="h-2 w-2 rounded-full" 
                    style={getDotStyle(stage.color)} 
                  />
                  <span>{stage.name}</span>
                  <Badge 
                    variant="secondary" 
                    className="ml-2"
                    style={getBadgeStyle(stage.color)}
                  >
                    {count}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
          {/* Orphan leads option */}
          {orphanLeads.length > 0 && (
            <SelectItem value="__orphan__">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span>Sem Etapa</span>
                <Badge variant="secondary" className="ml-2 bg-muted text-muted-foreground">
                  {orphanLeads.length}
                </Badge>
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Sem leads nesta fase</p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                upcomingEvent={leadEvents[lead.id]}
                onStatusChange={onStatusChange}
                onTemperatureChange={onTemperatureChange}
                onViewDetails={onViewDetails}
                onDelete={onDelete}
                pipelineStages={stages}
                isLocked={isFinalStatus(lead.status || '') && !isAdmin}
              />
          ))
        )}
      </div>
    </div>
  );
}
