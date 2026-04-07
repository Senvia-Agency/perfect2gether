-- Adicionar coluna whatsapp_base_url
ALTER TABLE public.organizations
ADD COLUMN whatsapp_base_url text;

-- Comentário para documentação
COMMENT ON COLUMN public.organizations.whatsapp_base_url 
IS 'URL base do servidor Evolution API (ex: https://api.senvia.com)';

-- Remover coluna whatsapp_number
ALTER TABLE public.organizations
DROP COLUMN whatsapp_number;