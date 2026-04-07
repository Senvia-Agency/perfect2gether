-- Add client fields settings column to organizations
ALTER TABLE organizations
ADD COLUMN client_fields_settings JSONB DEFAULT '{
  "name": {"visible": true, "required": true, "label": "Nome"},
  "email": {"visible": true, "required": false, "label": "Email"},
  "phone": {"visible": true, "required": false, "label": "Telefone"},
  "company": {"visible": true, "required": false, "label": "Empresa"},
  "nif": {"visible": true, "required": false, "label": "NIF"},
  "address": {"visible": true, "required": false, "label": "Morada"},
  "notes": {"visible": true, "required": false, "label": "Notas"}
}'::jsonb;