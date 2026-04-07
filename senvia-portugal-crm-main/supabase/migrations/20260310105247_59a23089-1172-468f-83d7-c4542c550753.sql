
-- Add inbound webhook token to organizations for Zapier/Make integration
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS webhook_token uuid DEFAULT gen_random_uuid();

-- Backfill existing orgs that might have NULL
UPDATE public.organizations SET webhook_token = gen_random_uuid() WHERE webhook_token IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.organizations ALTER COLUMN webhook_token SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN webhook_token SET DEFAULT gen_random_uuid();
