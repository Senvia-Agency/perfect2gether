
-- Add automation fields to email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_trigger_type text,
  ADD COLUMN IF NOT EXISTS automation_trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS automation_delay_minutes integer NOT NULL DEFAULT 0;
