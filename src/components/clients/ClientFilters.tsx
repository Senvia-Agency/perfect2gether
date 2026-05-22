import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useClientLabels } from "@/hooks/useClientLabels";
import type { ClientStatus } from "@/types/clients";
import type { TeamMember } from "@/hooks/useTeam";
import { useTeamScopedMembers } from "@/hooks/useTeamFilter";

export interface ClientFiltersState {
  status: ClientStatus | 'all';
  assignedTo: string | 'all';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  proposalType: 'all' | 'energia' | 'servicos';
}

interface ClientFiltersProps {
  filters: ClientFiltersState;
  onFiltersChange: (filters: ClientFiltersState) => void;
  onClearFilters: () => void;
  isTelecom?: boolean;
  teamMembers?: TeamMember[];
}

export const defaultFilters: ClientFiltersState = {
  status: 'all',
  assignedTo: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  proposalType: 'all',
};

export function ClientFilters({ filters, onFiltersChange, onClearFilters, isTelecom, teamMembers = [] }: ClientFiltersProps) {
  const labels = useClientLabels();
  // Filtro por colaborador: só para admin / líder de equipa; líder vê só a sua equipa.
  const { members: scopedMembers, canFilterByTeam, allOptionLabel } = useTeamScopedMembers(teamMembers);

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.assignedTo !== 'all' ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined ||
    filters.proposalType !== 'all';

  const statusOptions: { value: ClientStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: labels.active },
    { value: 'vip', label: labels.vip },
    { value: 'inactive', label: labels.inactive },
  ];

  const activeFilterTags: { label: string; onRemove: () => void }[] = [];

  if (filters.status !== 'all') {
    const opt = statusOptions.find(o => o.value === filters.status);
    activeFilterTags.push({
      label: `Estado: ${opt?.label ?? filters.status}`,
      onRemove: () => onFiltersChange({ ...filters, status: 'all' }),
    });
  }

  if (canFilterByTeam && filters.assignedTo !== 'all') {
    const member = teamMembers.find(m => m.user_id === filters.assignedTo);
    activeFilterTags.push({
      label: `Colaborador: ${member?.full_name ?? filters.assignedTo}`,
      onRemove: () => onFiltersChange({ ...filters, assignedTo: 'all' }),
    });
  }

  if (filters.proposalType !== 'all') {
    const label = filters.proposalType === 'energia' ? 'Energia' : 'Outros Serviços';
    activeFilterTags.push({
      label: `Tipo: ${label}`,
      onRemove: () => onFiltersChange({ ...filters, proposalType: 'all' }),
    });
  }

  if (filters.dateFrom) {
    activeFilterTags.push({
      label: `De: ${format(filters.dateFrom, 'dd/MM/yyyy')}`,
      onRemove: () => onFiltersChange({ ...filters, dateFrom: undefined }),
    });
  }

  if (filters.dateTo) {
    activeFilterTags.push({
      label: `Até: ${format(filters.dateTo, 'dd/MM/yyyy')}`,
      onRemove: () => onFiltersChange({ ...filters, dateTo: undefined }),
    });
  }

  return (
    <div className="space-y-2">
      {/* Active filter tags */}
      {activeFilterTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilterTags.map((tag) => (
            <Badge
              key={tag.label}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-xs"
            >
              {tag.label}
              <button
                onClick={tag.onRemove}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={onClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Filter controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value as ClientStatus | 'all' })}
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Collaborator Filter — apenas para admin / líder de equipa */}
        {canFilterByTeam && (
          <Select
            value={filters.assignedTo}
            onValueChange={(value) => onFiltersChange({ ...filters, assignedTo: value })}
          >
            <SelectTrigger className="w-[210px] h-9">
              <SelectValue placeholder="Colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allOptionLabel}</SelectItem>
              {scopedMembers.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Proposal Type Filter (Telecom only) */}
        {isTelecom && (
          <Select
            value={filters.proposalType}
            onValueChange={(value) => onFiltersChange({ ...filters, proposalType: value as 'all' | 'energia' | 'servicos' })}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="energia">Energia</SelectItem>
              <SelectItem value="servicos">Outros Serviços</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 justify-start text-left font-normal",
                !filters.dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yy", { locale: pt }) : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
              initialFocus
              locale={pt}
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 justify-start text-left font-normal",
                !filters.dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, "dd/MM/yy", { locale: pt }) : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
              initialFocus
              locale={pt}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
