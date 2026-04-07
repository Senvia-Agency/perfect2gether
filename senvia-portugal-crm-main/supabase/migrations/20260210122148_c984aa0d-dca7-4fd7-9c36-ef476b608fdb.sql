ALTER TABLE public.organizations
  ADD COLUMN integrations_enabled jsonb 
  DEFAULT '{"webhook": true, "whatsapp": true, "brevo": true, "invoicexpress": true}'::jsonb;