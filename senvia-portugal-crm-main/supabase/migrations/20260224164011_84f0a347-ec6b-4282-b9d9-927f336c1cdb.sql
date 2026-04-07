
-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Members can create tickets in their org
CREATE POLICY "Members can create support tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND user_id = auth.uid()
);

-- Members can view their org's tickets
CREATE POLICY "Members can view org support tickets"
ON public.support_tickets
FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

-- Super admin full access
CREATE POLICY "Super admin full access support_tickets"
ON public.support_tickets
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));
