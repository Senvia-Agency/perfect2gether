import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCombobox, type ComboboxOption } from '@/components/ui/searchable-combobox';
import { Switch } from '@/components/ui/switch';
import { useCreateEvent, useUpdateEvent } from '@/hooks/useCalendarEvents';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useSendTemplateEmail } from '@/hooks/useSendTemplateEmail';
import { supabase } from '@/integrations/supabase/client';
import { EVENT_TYPE_LABELS, REMINDER_OPTIONS, type CalendarEvent, type EventType } from '@/types/calendar';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Video, Phone, CheckSquare, RefreshCw, Loader2, Mail, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

const EVENT_TYPE_ICONS: Record<EventType, React.ReactNode> = {
  meeting: <Video className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  follow_up: <RefreshCw className="h-4 w-4" />,
};

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  event?: CalendarEvent | null;
  preselectedLeadId?: string;
  onSuccess?: () => void;
}

export function CreateEventModal({ open, onOpenChange, selectedDate, event, preselectedLeadId, onSuccess }: CreateEventModalProps) {
  const { data: leads = [] } = useLeads();
  const { organization } = useAuth();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const sendTemplateEmail = useSendTemplateEmail();

  // Calendar alert settings from organization
  const [calendarSettings, setCalendarSettings] = useState<{
    default_reminder_minutes: number | null;
    auto_reminder_meetings: boolean;
    auto_reminder_hours: number | null;
    auto_reminder_days: number | null;
  } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      if (!organization?.id) return;
      const { data } = await supabase
        .from('organizations')
        .select('calendar_alert_settings')
        .eq('id', organization.id)
        .single();
      if (data) {
        const raw = (data as any).calendar_alert_settings;
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
          let hours: number | null = raw.auto_reminder_hours ?? null;
          let days: number | null = raw.auto_reminder_days ?? null;
          if (hours === null && days === null && raw.auto_reminder_minutes != null) {
            const mins = raw.auto_reminder_minutes as number;
            if (mins >= 1440) { days = Math.round(mins / 1440); }
            else { hours = Math.round(mins / 60) || 1; }
          }
          setCalendarSettings({ ...raw, auto_reminder_hours: hours, auto_reminder_days: days });
        }
      }
    }
    fetchSettings();
  }, [organization?.id]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('task');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [leadId, setLeadId] = useState<string>('');
  const [reminderMinutes, setReminderMinutes] = useState<string>('');
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  const isEditing = !!event;

  // Find selected lead to check if they have email
  const selectedLead = useMemo(() => {
    if (!leadId) return null;
    return leads.find(l => l.id === leadId) || null;
  }, [leadId, leads]);

  const showMeetingLink = eventType === 'meeting' || eventType === 'call';
  const canSendEmail = !!selectedLead?.email && showMeetingLink;

  const calculateAutoEndTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const endHour = (hours + 1) % 24;
    return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (!endTimeManuallySet) {
      setEndTime(calculateAutoEndTime(newStartTime));
    }
  };

  const handleEndTimeChange = (newEndTime: string) => {
    setEndTimeManuallySet(true);
    setEndTime(newEndTime);
  };

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setEventType(event.event_type);
      setStartDate(format(new Date(event.start_time), 'yyyy-MM-dd'));
      setStartTime(format(new Date(event.start_time), 'HH:mm'));
      if (event.end_time) {
        setEndDate(format(new Date(event.end_time), 'yyyy-MM-dd'));
        setEndTime(format(new Date(event.end_time), 'HH:mm'));
      }
      setAllDay(event.all_day);
      setLeadId(event.lead_id || '');
      setReminderMinutes(event.reminder_minutes?.toString() || '');
      setMeetingLink(event.meeting_link || '');
      setEndTimeManuallySet(true);
      setSendEmail(false);
    } else if (selectedDate) {
      setStartDate(format(selectedDate, 'yyyy-MM-dd'));
      setEndDate(format(selectedDate, 'yyyy-MM-dd'));
      setEndTimeManuallySet(false);
      setReminderMinutes('');
      setMeetingLink('');
      setSendEmail(false);
    }
    
    if (preselectedLeadId && open && !event) {
      setLeadId(preselectedLeadId);
      setEventType('meeting');
    }
  }, [event, selectedDate, open, preselectedLeadId, calendarSettings]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('task');
    setStartDate('');
    setStartTime('09:00');
    setEndDate('');
    setEndTime('10:00');
    setAllDay(false);
    setLeadId('');
    setReminderMinutes('');
    setEndTimeManuallySet(false);
    setMeetingLink('');
    setSendEmail(false);
  };

  const buildMeetingEmailHtml = (leadName: string, dateStr: string, timeStr: string, link: string, orgName: string) => {
    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Reunião Agendada</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${orgName}</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #334155; font-size: 16px; margin: 0 0 24px;">Olá <strong>${leadName}</strong>,</p>
          <p style="color: #475569; font-size: 15px; margin: 0 0 24px;">A sua reunião foi agendada com sucesso. Aqui estão os detalhes:</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">📅 Data:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🕐 Hora:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${timeStr}</td>
              </tr>
            </table>
          </div>
          ${link ? `
          <div style="text-align: center; margin: 28px 0;">
            <a href="${link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
              🔗 Aceder à Reunião
            </a>
          </div>
          ` : ''}
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0; text-align: center;">Se tiver alguma questão, não hesite em contactar-nos.</p>
        </div>
      </div>
    `;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startDateTime = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString();

    const endDateTime = endDate
      ? allDay
        ? new Date(`${endDate}T23:59:59`).toISOString()
        : new Date(`${endDate}T${endTime}:00`).toISOString()
      : undefined;

    const params = {
      title,
      description: description || undefined,
      event_type: eventType,
      start_time: startDateTime,
      end_time: endDateTime,
      all_day: allDay,
      lead_id: leadId || undefined,
      meeting_link: meetingLink || undefined,
      reminder_minutes: reminderMinutes
        ? parseInt(reminderMinutes)
        : (calendarSettings?.auto_reminder_meetings)
          ? (() => {
              const hoursMins = calendarSettings.auto_reminder_hours != null ? calendarSettings.auto_reminder_hours * 60 : null;
              const daysMins = calendarSettings.auto_reminder_days != null ? calendarSettings.auto_reminder_days * 1440 : null;
              if (hoursMins != null && daysMins != null) return Math.min(hoursMins, daysMins);
              return hoursMins ?? daysMins ?? null;
            })()
          : null,
    };

    if (isEditing && event) {
      await updateEvent.mutateAsync({ id: event.id, ...params });
    } else {
      await createEvent.mutateAsync(params);
    }

    // Send email after event creation/update
    if (sendEmail && canSendEmail && selectedLead) {
      try {
        const eventDate = new Date(`${startDate}T${startTime}:00`);
        const dateStr = format(eventDate, "d 'de' MMMM 'de' yyyy", { locale: pt });
        const timeStr = allDay ? 'Dia inteiro' : startTime;
        const orgName = organization?.name || 'A nossa equipa';

        await sendTemplateEmail.mutateAsync({
          recipients: [{
            email: selectedLead.email,
            name: selectedLead.name,
          }],
          subject: `Reunião Agendada — ${orgName}`,
          htmlContent: buildMeetingEmailHtml(selectedLead.name, dateStr, timeStr, meetingLink, orgName),
        });
      } catch {
        toast.error('Evento criado, mas falha ao enviar email.');
      }
    }

    resetForm();
    onSuccess?.();
    onOpenChange(false);
  };

  const isPending = createEvent.isPending || updateEvent.isPending || sendTemplateEmail.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião com cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Evento</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {EVENT_TYPE_ICONS[type]}
                      {EVENT_TYPE_LABELS[type]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={allDay} onCheckedChange={setAllDay} id="all-day" />
            <Label htmlFor="all-day">Dia inteiro</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>Hora Fim</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Lead Associado</Label>
            <SearchableCombobox
              options={leads.map((lead): ComboboxOption => ({
                value: lead.id,
                label: lead.name,
                sublabel: lead.email || lead.phone || undefined,
              }))}
              value={leadId || null}
              onValueChange={(v) => setLeadId(v || "")}
              placeholder="Selecionar lead..."
              searchPlaceholder="Pesquisar lead..."
              emptyLabel="Nenhum"
              emptyText="Nenhum lead encontrado."
            />
          </div>

          {/* Meeting Link - visible for meeting/call */}
          {showMeetingLink && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Link da Reunião
              </Label>
              <Input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://teams.microsoft.com/..."
              />
            </div>
          )}

          {/* Send Email Toggle - visible when lead has email */}
          {canSendEmail && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="send-email" className="text-sm font-medium cursor-pointer">
                  Enviar email ao lead
                </Label>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedLead?.email}
                </p>
              </div>
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} id="send-email" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Lembrete</Label>
            <Select value={reminderMinutes || "none"} onValueChange={(v) => setReminderMinutes(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem lembrete" />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value ?? 'none'} value={option.value?.toString() ?? 'none'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas adicionais..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
