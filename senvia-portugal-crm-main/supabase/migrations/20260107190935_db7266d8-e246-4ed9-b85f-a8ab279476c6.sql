-- Add custom_data column to leads table for storing custom field responses
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}';

-- Update the default form_settings to include custom_fields array
ALTER TABLE public.organizations 
ALTER COLUMN form_settings 
SET DEFAULT '{
  "title": "Deixe o seu Contacto",
  "labels": {
    "name": "Nome Completo",
    "email": "Email",
    "phone": "Telemóvel",
    "message": "Mensagem (opcional)"
  },
  "logo_url": null,
  "subtitle": "Preencha os dados abaixo e entraremos em contacto consigo.",
  "error_message": "Não foi possível enviar o formulário. Tente novamente.",
  "primary_color": "#3B82F6",
  "success_message": {
    "title": "Obrigado!",
    "description": "Recebemos o seu contacto e entraremos em contacto brevemente."
  },
  "show_message_field": false,
  "custom_fields": []
}'::jsonb;