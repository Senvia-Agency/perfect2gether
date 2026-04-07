-- Tabela de formulários (múltiplos por organização)
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  form_settings JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_org_form_slug UNIQUE(organization_id, slug)
);

-- Índices para performance
CREATE INDEX idx_forms_organization_id ON public.forms(organization_id);
CREATE INDEX idx_forms_slug ON public.forms(slug);
CREATE INDEX idx_forms_is_default ON public.forms(is_default) WHERE is_default = true;

-- Trigger para updated_at
CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view org forms"
  ON public.forms FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org forms"
  ON public.forms FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admin full access forms"
  ON public.forms FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Função para buscar formulário por slugs (público)
CREATE OR REPLACE FUNCTION public.get_form_by_slugs(_org_slug text, _form_slug text DEFAULT NULL)
RETURNS TABLE(
  form_id uuid,
  form_name text,
  form_settings jsonb,
  org_id uuid,
  org_name text,
  org_slug text,
  meta_pixels jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id as form_id,
    f.name as form_name,
    f.form_settings,
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    o.meta_pixels
  FROM public.forms f
  JOIN public.organizations o ON o.id = f.organization_id
  WHERE o.slug = _org_slug
    AND f.is_active = true
    AND (
      (_form_slug IS NOT NULL AND f.slug = _form_slug)
      OR (_form_slug IS NULL AND f.is_default = true)
    )
  LIMIT 1
$$;

-- Adicionar form_id à tabela leads para tracking
ALTER TABLE public.leads 
  ADD COLUMN form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_form_id ON public.leads(form_id);

-- Migrar form_settings existentes para formulários default
INSERT INTO public.forms (organization_id, name, slug, form_settings, is_default, is_active)
SELECT 
  id as organization_id,
  'Formulário Principal' as name,
  'principal' as slug,
  COALESCE(form_settings, '{}'::jsonb) as form_settings,
  true as is_default,
  true as is_active
FROM public.organizations
WHERE id IS NOT NULL;