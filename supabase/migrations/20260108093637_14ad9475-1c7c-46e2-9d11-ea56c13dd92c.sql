-- Add WhatsApp Business integration fields to organizations
ALTER TABLE public.organizations 
ADD COLUMN whatsapp_instance text,
ADD COLUMN whatsapp_number text,
ADD COLUMN whatsapp_api_key text;

COMMENT ON COLUMN public.organizations.whatsapp_instance IS 'Evolution API instance name';
COMMENT ON COLUMN public.organizations.whatsapp_number IS 'WhatsApp Business phone number';
COMMENT ON COLUMN public.organizations.whatsapp_api_key IS 'Evolution API authentication key';