-- Create proposal_cpes table to link CPEs with proposals
CREATE TABLE public.proposal_cpes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  existing_cpe_id UUID REFERENCES public.cpes(id) ON DELETE SET NULL,
  equipment_type TEXT NOT NULL,
  serial_number TEXT,
  comercializador TEXT NOT NULL,
  fidelizacao_start DATE,
  fidelizacao_end DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_cpes ENABLE ROW LEVEL SECURITY;

-- RLS Policies based on proposal's organization
CREATE POLICY "Users view proposal cpes"
ON public.proposal_cpes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_cpes.proposal_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Users insert proposal cpes"
ON public.proposal_cpes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_cpes.proposal_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Users delete proposal cpes"
ON public.proposal_cpes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_cpes.proposal_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Super admin full access proposal_cpes"
ON public.proposal_cpes
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime for proposal_cpes
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_cpes;