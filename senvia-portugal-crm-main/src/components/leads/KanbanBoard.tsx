import { useState, useRef, useEffect } from "react";
import { Lead, LeadTemperature } from "@/types";
import { LeadCard } from "./LeadCard";
import { cn } from "@/lib/utils";
import { usePipelineStages, PipelineStage } from "@/hooks/usePipelineStages";
import { useLeadProposalValues } from "@/hooks/useLeadProposalValues";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface LeadEvent {
  id: string;
  title: string;
  start_time: string;
  event_type: string;
}

interface KanbanBoardProps {
  leads: Lead[];
  leadEvents?: Record<string, LeadEvent>;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onTemperatureChange: (leadId: string, temperature: LeadTemperature) => void;
  onViewDetails: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
}

export function KanbanBoard({ leads, leadEvents = {}, onStatusChange, onTemperatureChange, onViewDetails, onDelete }: KanbanBoardProps) {
  const { data: stages, isLoading: stagesLoading } = usePipelineStages();
  const { data: proposalValues } = useLeadProposalValues();
  const { isAdmin } = usePermissions();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  useEffect(() => {
    if (bottomScrollRef.current) {
      setScrollWidth(bottomScrollRef.current.scrollWidth);
    }
  }, [leads, stages]);

  const handleTopScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const isFinalStatus = (status: string) => {
    const stage = stages?.find(s => s.key === status);
    return stage?.is_final_positive || stage?.is_final_negative || false;
  };

  const getLeadsByStatus = (statusKey: string) => 
    leads.filter(lead => lead.status === statusKey);

  // Get orphan leads (leads with status not matching any pipeline stage)
  const getOrphanLeads = () => {
    if (!stages) return [];
    const stageKeys = stages.map(s => s.key);
    return leads.filter(lead => !stageKeys.includes(lead.status || ''));
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    // Block drag for leads in final stages if not admin
    const lead = leads.find(l => l.id === leadId);
    if (lead && isFinalStatus(lead.status || '') && !isAdmin) {
      e.preventDefault();
      return;
    }
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, statusKey: string) => {
    e.preventDefault();
    setDragOverColumn(statusKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, statusKey: string) => {
    e.preventDefault();
    if (draggedLead) {
      onStatusChange(draggedLead, statusKey);
    }
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  // Generate dynamic styles based on stage color
  const getColumnBorderStyle = (stage: PipelineStage) => ({
    borderTopColor: stage.color,
  });

  const getColumnBadgeStyle = (stage: PipelineStage) => ({
    backgroundColor: `${stage.color}15`,
    color: stage.color,
  });

  const orphanLeads = getOrphanLeads();

  if (stagesLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-80 min-w-[320px]">
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Pipeline não configurado</p>
          <p className="text-sm">Vá às Definições → Pipeline para configurar as etapas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Top scroll bar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden h-3 mb-2"
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>

      {/* Kanban container */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className="flex gap-4 overflow-x-auto pb-4"
      >
        {/* Orphan Leads Column - Only show if there are orphans */}
        {orphanLeads.length > 0 && (
          <div
            className={cn(
              "flex w-80 min-w-[320px] flex-col rounded-xl border-t-4 bg-muted/30",
              "border-t-orange-500",
              dragOverColumn === '__orphan__' && "bg-primary/5"
            )}
            onDragOver={(e) => handleDragOver(e, '__orphan__')}
            onDragLeave={handleDragLeave}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-foreground">
                  Sem Etapa
                </h3>
                <span 
                  className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium bg-orange-500/15 text-orange-500"
                >
                  {orphanLeads.length}
                </span>
              </div>
            </div>

            {/* Cards Container */}
            <div className="flex-1 space-y-3 px-3 pb-3">
              {orphanLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable={!isFinalStatus(lead.status || '') || isAdmin}
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="animate-fade-in"
                >
                  <LeadCard
                    lead={lead}
                    proposalValue={proposalValues?.get(lead.id)}
                    upcomingEvent={leadEvents[lead.id]}
                    onStatusChange={onStatusChange}
                    onTemperatureChange={onTemperatureChange}
                    onViewDetails={onViewDetails}
                    onDelete={onDelete}
                    isDragging={draggedLead === lead.id}
                    pipelineStages={stages}
                    isLocked={isFinalStatus(lead.status || '') && !isAdmin}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regular Pipeline Columns */}
        {stages.map((stage) => {
          const columnLeads = getLeadsByStatus(stage.key);
          const isOver = dragOverColumn === stage.key;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex w-80 min-w-[320px] flex-col rounded-xl border-t-4 bg-muted/30",
                isOver && "bg-primary/5"
              )}
              style={getColumnBorderStyle(stage)}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {stage.name}
                  </h3>
                  <span 
                    className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium"
                    style={getColumnBadgeStyle(stage)}
                  >
                    {columnLeads.length}
                  </span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 px-3 pb-3">
                {columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable={!isFinalStatus(lead.status || '') || isAdmin}
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="animate-fade-in"
                  >
                    <LeadCard
                      lead={lead}
                      proposalValue={proposalValues?.get(lead.id)}
                      upcomingEvent={leadEvents[lead.id]}
                      onStatusChange={onStatusChange}
                      onTemperatureChange={onTemperatureChange}
                      onViewDetails={onViewDetails}
                      onDelete={onDelete}
                      isDragging={draggedLead === lead.id}
                      pipelineStages={stages}
                      isLocked={isFinalStatus(lead.status || '') && !isAdmin}
                    />
                  </div>
                ))}

                {columnLeads.length === 0 && (
                  <div className={cn(
                    "flex h-32 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground",
                    isOver && "border-primary bg-primary/5"
                  )}>
                    {isOver ? "Largar aqui" : "Sem leads"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
