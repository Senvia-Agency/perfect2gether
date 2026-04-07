-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Event details
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'task',
  
  -- Time
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean DEFAULT false,
  
  -- Status
  status text DEFAULT 'pending',
  
  -- Reminder
  reminder_minutes integer,
  reminder_sent boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_org ON public.calendar_events(organization_id);
CREATE INDEX idx_calendar_events_start ON public.calendar_events(start_time);
CREATE INDEX idx_calendar_events_lead ON public.calendar_events(lead_id);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Users read their own events, admins read all org events
CREATE POLICY "Users read calendar events" ON public.calendar_events
FOR SELECT USING (
  organization_id = get_user_org_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
    OR user_id = auth.uid()
  )
);

-- Users create events for themselves
CREATE POLICY "Users insert own events" ON public.calendar_events
FOR INSERT WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND user_id = auth.uid()
);

-- Users update their own events, admins update all
CREATE POLICY "Users update events" ON public.calendar_events
FOR UPDATE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Users delete their own events, admins delete all
CREATE POLICY "Users delete events" ON public.calendar_events
FOR DELETE USING (
  organization_id = get_user_org_id(auth.uid())
  AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Super admin full access
CREATE POLICY "Super admin full access calendar" ON public.calendar_events
FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();