-- Table for saving client lists/segments
CREATE TABLE public.client_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB DEFAULT '{}',
  is_dynamic BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for static list members
CREATE TABLE public.client_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.client_lists(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, client_id)
);

-- Table for email send history
CREATE TABLE public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.crm_clients(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_lists
CREATE POLICY "Users can view their organization's lists"
ON public.client_lists FOR SELECT
USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create lists in their organization"
ON public.client_lists FOR INSERT
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update their organization's lists"
ON public.client_lists FOR UPDATE
USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete their organization's lists"
ON public.client_lists FOR DELETE
USING (organization_id = public.get_user_org_id(auth.uid()));

-- RLS Policies for client_list_members
CREATE POLICY "Users can view members of their organization's lists"
ON public.client_list_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.client_lists cl
  WHERE cl.id = list_id
  AND cl.organization_id = public.get_user_org_id(auth.uid())
));

CREATE POLICY "Users can add members to their organization's lists"
ON public.client_list_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.client_lists cl
  WHERE cl.id = list_id
  AND cl.organization_id = public.get_user_org_id(auth.uid())
));

CREATE POLICY "Users can remove members from their organization's lists"
ON public.client_list_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.client_lists cl
  WHERE cl.id = list_id
  AND cl.organization_id = public.get_user_org_id(auth.uid())
));

-- RLS Policies for email_sends
CREATE POLICY "Users can view their organization's email sends"
ON public.email_sends FOR SELECT
USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create email sends in their organization"
ON public.email_sends FOR INSERT
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_client_lists_org ON public.client_lists(organization_id);
CREATE INDEX idx_client_list_members_list ON public.client_list_members(list_id);
CREATE INDEX idx_email_sends_org ON public.email_sends(organization_id);
CREATE INDEX idx_email_sends_template ON public.email_sends(template_id);
CREATE INDEX idx_email_sends_client ON public.email_sends(client_id);
CREATE INDEX idx_email_sends_status ON public.email_sends(status);

-- Trigger for updated_at on client_lists
CREATE TRIGGER update_client_lists_updated_at
BEFORE UPDATE ON public.client_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();