
-- Create marketing_contacts table
CREATE TABLE public.marketing_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'manual',
  tags JSONB DEFAULT '[]'::jsonb,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index on org + email (only where email is not null)
CREATE UNIQUE INDEX idx_marketing_contacts_org_email 
  ON public.marketing_contacts (organization_id, email) 
  WHERE email IS NOT NULL;

-- Enable RLS
ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view marketing contacts"
  ON public.marketing_contacts FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert marketing contacts"
  ON public.marketing_contacts FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update marketing contacts"
  ON public.marketing_contacts FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete marketing contacts"
  ON public.marketing_contacts FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

-- Create marketing_list_members table
CREATE TABLE public.marketing_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.client_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_marketing_list_members_unique 
  ON public.marketing_list_members (list_id, contact_id);

ALTER TABLE public.marketing_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view marketing list members"
  ON public.marketing_list_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_lists cl 
    WHERE cl.id = list_id 
    AND public.is_org_member(auth.uid(), cl.organization_id)
  ));

CREATE POLICY "Org members can insert marketing list members"
  ON public.marketing_list_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_lists cl 
    WHERE cl.id = list_id 
    AND public.is_org_member(auth.uid(), cl.organization_id)
  ));

CREATE POLICY "Org members can delete marketing list members"
  ON public.marketing_list_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.client_lists cl 
    WHERE cl.id = list_id 
    AND public.is_org_member(auth.uid(), cl.organization_id)
  ));

-- Trigger for updated_at
CREATE TRIGGER update_marketing_contacts_updated_at
  BEFORE UPDATE ON public.marketing_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate imported clients to marketing_contacts
INSERT INTO public.marketing_contacts (organization_id, name, email, phone, company, source, created_at, updated_at)
SELECT organization_id, name, email, phone, company, 'import', created_at, COALESCE(updated_at, now())
FROM public.crm_clients
WHERE source = 'import';

-- Migrate list memberships: remap client_id -> contact_id
INSERT INTO public.marketing_list_members (list_id, contact_id, added_at)
SELECT clm.list_id, mc.id, clm.added_at
FROM public.client_list_members clm
JOIN public.crm_clients cc ON cc.id = clm.client_id AND cc.source = 'import'
JOIN public.marketing_contacts mc ON mc.email = cc.email AND mc.organization_id = cc.organization_id
WHERE cc.email IS NOT NULL;

-- Also handle contacts without email (match by name + org)
INSERT INTO public.marketing_list_members (list_id, contact_id, added_at)
SELECT clm.list_id, mc.id, clm.added_at
FROM public.client_list_members clm
JOIN public.crm_clients cc ON cc.id = clm.client_id AND cc.source = 'import'
JOIN public.marketing_contacts mc ON mc.name = cc.name AND mc.organization_id = cc.organization_id AND mc.email IS NULL
WHERE cc.email IS NULL
ON CONFLICT (list_id, contact_id) DO NOTHING;

-- Delete old list memberships for imported clients
DELETE FROM public.client_list_members
WHERE client_id IN (SELECT id FROM public.crm_clients WHERE source = 'import');

-- Delete imported clients from CRM
DELETE FROM public.crm_clients WHERE source = 'import';
