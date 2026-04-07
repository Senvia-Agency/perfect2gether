import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { CalendarEvent } from '@/types/calendar';
import { EventCard } from './EventCard';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  selectedDay?: Date;
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function MonthView({ currentDate, events, selectedDay, onDayClick, onEventClick }: MonthViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(new Date(event.start_time), day));
  };

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={index}
              onClick={() => onDayClick(day)}
              className={cn(
                'min-h-[100px] sm:min-h-[120px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-accent/50',
                !isCurrentMonth && 'bg-muted/30',
                selectedDay && isSameDay(day, selectedDay) && 'ring-2 ring-primary ring-inset bg-primary/5'
              )}
            >
              <div className="flex items-center justify-center mb-1">
                <span
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-full text-sm',
                    isCurrentDay && 'bg-primary text-primary-foreground font-semibold',
                    !isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    compact
                     onClick={(e) => {
                       e.stopPropagation();
                       onDayClick(day);
                       onEventClick(event);
                     }}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{dayEvents.length - 2} mais
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
