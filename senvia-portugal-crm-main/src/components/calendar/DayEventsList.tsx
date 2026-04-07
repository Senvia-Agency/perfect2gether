import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarPlus, CalendarX2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventCard } from './EventCard';
import type { CalendarEvent } from '@/types/calendar';

interface DayEventsListProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent: () => void;
}

export function DayEventsList({ selectedDate, events, onEventClick, onCreateEvent }: DayEventsListProps) {
  return (
    <div className="mt-4 bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          Eventos de {format(selectedDate, "d 'de' MMMM", { locale: pt })}
        </h3>
        <Button size="sm" variant="outline" onClick={onCreateEvent} className="gap-1.5">
          <CalendarPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Evento</span>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CalendarX2 className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Sem eventos agendados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick(event)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
