
-- Create organization_webhooks table
CREATE TABLE public.organization_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_webhooks ENABLE ROW LEVEL SECURITY;

-- Members can view org webhooks (excluding system ones handled by app logic)
CREATE POLICY "Members view org webhooks"
ON public.organization_webhooks
FOR SELECT
USING (is_org_member(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Admins can insert webhooks (not system ones)
CREATE POLICY "Admins insert org webhooks"
ON public.organization_webhooks
FOR INSERT
WITH CHECK (
  (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role) AND is_system = false)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Admins can update webhooks (not system ones)
CREATE POLICY "Admins update org webhooks"
ON public.organization_webhooks
FOR UPDATE
USING (
  (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role) AND is_system = false)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Admins can delete webhooks (not system ones)
CREATE POLICY "Admins delete org webhooks"
ON public.organization_webhooks
FOR DELETE
USING (
  (is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role) AND is_system = false)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Migrate existing webhook_url data
INSERT INTO public.organization_webhooks (organization_id, name, url, is_active, is_system)
SELECT id, 'Webhook Principal', webhook_url, true, false
FROM public.organizations
WHERE webhook_url IS NOT NULL AND webhook_url != '';
