-- Create pipeline_stages table for configurable pipelines per organization
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  is_final_positive BOOLEAN DEFAULT false,
  is_final_negative BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, key)
);

-- Add niche column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'generic';

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view org pipeline stages"
ON public.pipeline_stages
FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org pipeline stages"
ON public.pipeline_stages
FOR ALL
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_org_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Super admin full access pipeline_stages"
ON public.pipeline_stages
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create default pipeline stages for ALL existing organizations
INSERT INTO public.pipeline_stages (organization_id, name, key, color, position, is_final_positive, is_final_negative)
SELECT 
  o.id as organization_id,
  stage.name,
  stage.key,
  stage.color,
  stage.position,
  stage.is_final_positive,
  stage.is_final_negative
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('Novo', 'new', '#3B82F6', 1, false, false),
    ('Contactado', 'contacted', '#A855F7', 2, false, false),
    ('Agendado', 'scheduled', '#F59E0B', 3, false, false),
    ('Proposta', 'proposal', '#06B6D4', 4, false, false),
    ('Ganho', 'won', '#22C55E', 5, true, false),
    ('Perdido', 'lost', '#6B7280', 6, false, true)
) AS stage(name, key, color, position, is_final_positive, is_final_negative)
ON CONFLICT (organization_id, key) DO NOTHING;