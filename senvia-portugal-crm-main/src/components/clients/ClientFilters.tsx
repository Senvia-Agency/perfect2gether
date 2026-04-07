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
import type { ClientStatus, ClientSource } from "@/types/clients";

export interface ClientFiltersState {
  status: ClientStatus | 'all';
  source: ClientSource | 'all';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  proposalType: 'all' | 'energia' | 'servicos';
}

interface ClientFiltersProps {
  filters: ClientFiltersState;
  onFiltersChange: (filters: ClientFiltersState) => void;
  onClearFilters: () => void;
  isTelecom?: boolean;
}

export const defaultFilters: ClientFiltersState = {
  status: 'all',
  source: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  proposalType: 'all',
};

export function ClientFilters({ filters, onFiltersChange, onClearFilters, isTelecom }: ClientFiltersProps) {
  const labels = useClientLabels();

  const hasActiveFilters = 
    filters.status !== 'all' || 
    filters.source !== 'all' || 
    filters.dateFrom !== undefined || 
    filters.dateTo !== undefined ||
    filters.proposalType !== 'all';

  const statusOptions: { value: ClientStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: labels.active },
    { value: 'vip', label: labels.vip },
    { value: 'inactive', label: labels.inactive },
  ];

  const sourceOptions: { value: ClientSource | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'lead', label: 'Lead Convertido' },
    { value: 'referral', label: 'Indicação' },
    { value: 'direct', label: 'Contacto Direto' },
    { value: 'website', label: 'Website' },
    { value: 'other', label: 'Outro' },
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Filter className="h-4 w-4 text-muted-foreground" />
      
      {/* Status Filter */}
      <Select
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ ...filters, status: value as ClientStatus | 'all' })}
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Source Filter */}
      <Select
        value={filters.source}
        onValueChange={(value) => onFiltersChange({ ...filters, source: value as ClientSource | 'all' })}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          {sourceOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
