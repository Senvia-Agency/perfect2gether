-- Add webhook_url column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN webhook_url TEXT DEFAULT NULL;