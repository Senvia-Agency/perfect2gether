ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS tax_config JSONB DEFAULT '{"tax_name": "IVA23", "tax_value": 23, "tax_exemption_reason": null}'::jsonb;