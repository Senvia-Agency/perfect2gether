
-- Tabela de automacoes de email
CREATE TABLE public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}',
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  delay_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  recipient_type text NOT NULL DEFAULT 'lead',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_triggered_at timestamptz,
  total_triggered integer NOT NULL DEFAULT 0
);

-- Fila de emails agendados
CREATE TABLE public.automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  variables jsonb DEFAULT '{}',
  template_id uuid NOT NULL REFERENCES email_templates(id),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage automations"
  ON public.email_automations FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org members can manage queue"
  ON public.automation_queue FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

-- Indices
CREATE INDEX idx_automations_org ON email_automations(organization_id);
CREATE INDEX idx_automations_trigger ON email_automations(trigger_type, is_active);
CREATE INDEX idx_queue_scheduled ON automation_queue(status, scheduled_for);

-- Trigger para updated_at
CREATE TRIGGER update_email_automations_updated_at
  BEFORE UPDATE ON public.email_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
