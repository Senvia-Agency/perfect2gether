-- Add AI qualification rules column to organizations
ALTER TABLE public.organizations
ADD COLUMN ai_qualification_rules text;

COMMENT ON COLUMN public.organizations.ai_qualification_rules IS 
'Instruções de prompt para a IA classificar leads (HOT/WARM/COLD)';