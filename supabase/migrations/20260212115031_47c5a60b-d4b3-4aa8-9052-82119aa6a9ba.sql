-- Add session caching fields for KeyInvoice API 5.0 authenticate flow
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS keyinvoice_sid text,
  ADD COLUMN IF NOT EXISTS keyinvoice_sid_expires_at timestamptz;