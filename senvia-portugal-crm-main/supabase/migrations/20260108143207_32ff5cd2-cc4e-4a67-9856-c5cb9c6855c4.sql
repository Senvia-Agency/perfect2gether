-- Add automation_enabled column to leads table
ALTER TABLE public.leads 
ADD COLUMN automation_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.leads.automation_enabled IS 
'Se true, a automação (WhatsApp, IA, notificações) será executada para este lead';