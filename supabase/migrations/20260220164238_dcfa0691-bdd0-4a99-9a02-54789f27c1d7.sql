
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS lead_fields_settings jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS proposal_fields_settings jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sale_fields_settings jsonb DEFAULT NULL;
