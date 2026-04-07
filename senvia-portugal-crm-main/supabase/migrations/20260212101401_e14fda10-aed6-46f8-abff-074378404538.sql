
-- Add KeyInvoice support columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'invoicexpress',
  ADD COLUMN IF NOT EXISTS keyinvoice_username text,
  ADD COLUMN IF NOT EXISTS keyinvoice_password text,
  ADD COLUMN IF NOT EXISTS keyinvoice_company_code text,
  ADD COLUMN IF NOT EXISTS keyinvoice_token text,
  ADD COLUMN IF NOT EXISTS keyinvoice_token_expires_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.billing_provider IS 'Billing provider: invoicexpress or keyinvoice';
