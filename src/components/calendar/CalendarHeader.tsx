import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export type ViewType = 'month' | 'week' | 'day';

interface CalendarHeaderProps {
  currentDate: Date;
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateEvent: () => void;
  filterUserId?: string;
  onFilterChange?: (userId: string) => void;
  teamMembers?: Array<{ id: string; full_name: string }>;
  isAdmin?: boolean;
}

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onCreateEvent,
  filterUserId,
  onFilterChange,
  teamMembers,
  isAdmin,
}: CalendarHeaderProps) {
  const getTitle = () => {
    switch (view) {
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: pt });
      case 'week':
        return format(currentDate, "'Semana de' d 'de' MMMM", { locale: pt });
      case 'day':
        return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-6 w-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold capitalize">{getTitle()}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Admin Filter */}
        {isAdmin && teamMembers && teamMembers.length > 0 && onFilterChange && (
          <Select value={filterUserId || 'all'} onValueChange={onFilterChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View Selector */}
        <Select value={view} onValueChange={(v) => onViewChange(v as ViewType)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="day">Dia</SelectItem>
          </SelectContent>
        </Select>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Create Event */}
        <Button onClick={onCreateEvent}>
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Novo Evento</span>
        </Button>
      </div>
    </div>
  );
}
