ALTER TABLE public.organizations 
ALTER COLUMN integrations_enabled 
SET DEFAULT '{"brevo": false, "webhook": false, "whatsapp": false, "invoicexpress": false}'::jsonb;