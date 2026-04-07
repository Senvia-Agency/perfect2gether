
-- Add settings_data JSONB column to email_campaigns for storing extra config values
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS settings_data jsonb DEFAULT '{}';
