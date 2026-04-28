import { CalendarView } from '@/components/calendar/CalendarView';
import { SEO } from '@/components/SEO';

export default function Calendar() {
  return (
    <>
      <SEO 
        title="Agenda | Perfect2Gether" 
        description="Gerencie a sua agenda de eventos e tarefas"
      />
      <CalendarView />
    </>
  );
}
