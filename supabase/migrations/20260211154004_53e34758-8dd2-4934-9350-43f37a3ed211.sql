
-- Add data_scope column to organization_profiles
ALTER TABLE public.organization_profiles
ADD COLUMN data_scope text NOT NULL DEFAULT 'own';

-- Update existing default profiles
UPDATE public.organization_profiles
SET data_scope = 'all'
WHERE base_role = 'admin';

UPDATE public.organization_profiles
SET data_scope = 'own'
WHERE base_role IN ('viewer', 'salesperson');
