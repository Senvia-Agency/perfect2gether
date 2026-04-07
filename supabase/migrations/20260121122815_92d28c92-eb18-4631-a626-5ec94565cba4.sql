-- Create email_templates table for marketing module
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'general',
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin full access email_templates"
  ON email_templates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins manage org email_templates"
  ON email_templates FOR ALL
  USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users view org email_templates"
  ON email_templates FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();