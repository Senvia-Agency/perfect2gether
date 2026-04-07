
-- Create email_campaigns table
CREATE TABLE public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view campaigns of their organization"
ON public.email_campaigns FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can create campaigns in their organization"
ON public.email_campaigns FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update campaigns in their organization"
ON public.email_campaigns FOR UPDATE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can delete campaigns in their organization"
ON public.email_campaigns FOR DELETE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

-- Add tracking columns to email_sends
ALTER TABLE public.email_sends
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS opened_at timestamptz,
ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
ADD COLUMN IF NOT EXISTS brevo_message_id text;

-- Trigger for updated_at on email_campaigns
CREATE TRIGGER update_email_campaigns_updated_at
BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_email_sends_campaign_id ON public.email_sends(campaign_id);
CREATE INDEX idx_email_sends_brevo_message_id ON public.email_sends(brevo_message_id);
CREATE INDEX idx_email_campaigns_org_id ON public.email_campaigns(organization_id);
