-- Add form_settings JSONB column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS form_settings JSONB DEFAULT '{
  "title": "Deixe o seu Contacto",
  "subtitle": "Preencha os dados abaixo e entraremos em contacto consigo.",
  "logo_url": null,
  "primary_color": "#3B82F6",
  "show_message_field": false,
  "labels": {
    "name": "Nome Completo",
    "email": "Email",
    "phone": "Telemóvel",
    "message": "Mensagem (opcional)"
  },
  "success_message": {
    "title": "Obrigado!",
    "description": "Recebemos o seu contacto e entraremos em contacto brevemente."
  },
  "error_message": "Não foi possível enviar o formulário. Tente novamente."
}'::jsonb;