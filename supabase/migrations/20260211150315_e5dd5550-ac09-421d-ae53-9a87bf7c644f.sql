
-- Create organization_profiles table
CREATE TABLE public.organization_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_role public.app_role NOT NULL DEFAULT 'viewer',
  module_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;

-- Members can read profiles of their org
CREATE POLICY "Members can view org profiles"
ON public.organization_profiles
FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Admins can manage profiles
CREATE POLICY "Admins can insert org profiles"
ON public.organization_profiles
FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins can update org profiles"
ON public.organization_profiles
FOR UPDATE
USING (
  (public.has_role(auth.uid(), 'admin') AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins can delete org profiles"
ON public.organization_profiles
FOR DELETE
USING (
  (public.has_role(auth.uid(), 'admin') AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Add profile_id to organization_members
ALTER TABLE public.organization_members
ADD COLUMN profile_id UUID REFERENCES public.organization_profiles(id) ON DELETE SET NULL;

-- Insert default profiles for all existing organizations
INSERT INTO public.organization_profiles (organization_id, name, base_role, module_permissions, is_default)
SELECT 
  o.id,
  'Administrador',
  'admin'::public.app_role,
  '{"leads":{"view":true,"edit":true,"delete":true},"clients":{"view":true,"edit":true,"delete":true},"proposals":{"view":true,"edit":true,"delete":true},"sales":{"view":true,"edit":true,"delete":true},"finance":{"view":true,"edit":true,"delete":true},"calendar":{"view":true,"edit":true,"delete":true},"marketing":{"view":true,"edit":true,"delete":true},"ecommerce":{"view":true,"edit":true,"delete":true},"settings":{"view":true,"edit":true,"delete":true}}'::jsonb,
  true
FROM public.organizations o;

INSERT INTO public.organization_profiles (organization_id, name, base_role, module_permissions, is_default)
SELECT 
  o.id,
  'Visualizador',
  'viewer'::public.app_role,
  '{"leads":{"view":true,"edit":false,"delete":false},"clients":{"view":true,"edit":false,"delete":false},"proposals":{"view":true,"edit":false,"delete":false},"sales":{"view":true,"edit":false,"delete":false},"finance":{"view":true,"edit":false,"delete":false},"calendar":{"view":true,"edit":false,"delete":false},"marketing":{"view":true,"edit":false,"delete":false},"ecommerce":{"view":true,"edit":false,"delete":false},"settings":{"view":false,"edit":false,"delete":false}}'::jsonb,
  true
FROM public.organizations o;

INSERT INTO public.organization_profiles (organization_id, name, base_role, module_permissions, is_default)
SELECT 
  o.id,
  'Vendedor',
  'salesperson'::public.app_role,
  '{"leads":{"view":true,"edit":true,"delete":false},"clients":{"view":true,"edit":true,"delete":false},"proposals":{"view":true,"edit":true,"delete":false},"sales":{"view":true,"edit":true,"delete":false},"finance":{"view":false,"edit":false,"delete":false},"calendar":{"view":true,"edit":true,"delete":false},"marketing":{"view":false,"edit":false,"delete":false},"ecommerce":{"view":false,"edit":false,"delete":false},"settings":{"view":false,"edit":false,"delete":false}}'::jsonb,
  true
FROM public.organizations o;

-- Create function to auto-create default profiles when a new org is created
CREATE OR REPLACE FUNCTION public.create_default_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.organization_profiles (organization_id, name, base_role, module_permissions, is_default) VALUES
  (NEW.id, 'Administrador', 'admin', '{"leads":{"view":true,"edit":true,"delete":true},"clients":{"view":true,"edit":true,"delete":true},"proposals":{"view":true,"edit":true,"delete":true},"sales":{"view":true,"edit":true,"delete":true},"finance":{"view":true,"edit":true,"delete":true},"calendar":{"view":true,"edit":true,"delete":true},"marketing":{"view":true,"edit":true,"delete":true},"ecommerce":{"view":true,"edit":true,"delete":true},"settings":{"view":true,"edit":true,"delete":true}}', true),
  (NEW.id, 'Visualizador', 'viewer', '{"leads":{"view":true,"edit":false,"delete":false},"clients":{"view":true,"edit":false,"delete":false},"proposals":{"view":true,"edit":false,"delete":false},"sales":{"view":true,"edit":false,"delete":false},"finance":{"view":true,"edit":false,"delete":false},"calendar":{"view":true,"edit":false,"delete":false},"marketing":{"view":true,"edit":false,"delete":false},"ecommerce":{"view":true,"edit":false,"delete":false},"settings":{"view":false,"edit":false,"delete":false}}', true),
  (NEW.id, 'Vendedor', 'salesperson', '{"leads":{"view":true,"edit":true,"delete":false},"clients":{"view":true,"edit":true,"delete":false},"proposals":{"view":true,"edit":true,"delete":false},"sales":{"view":true,"edit":true,"delete":false},"finance":{"view":false,"edit":false,"delete":false},"calendar":{"view":true,"edit":true,"delete":false},"marketing":{"view":false,"edit":false,"delete":false},"ecommerce":{"view":false,"edit":false,"delete":false},"settings":{"view":false,"edit":false,"delete":false}}', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_org_default_profiles
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.create_default_profiles();
