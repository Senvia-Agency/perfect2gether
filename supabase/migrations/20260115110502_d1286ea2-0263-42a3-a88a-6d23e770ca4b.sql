-- Add enabled_modules column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN enabled_modules JSONB DEFAULT '{"proposals": true, "calendar": true}'::jsonb;