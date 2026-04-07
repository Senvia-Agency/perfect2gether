-- Add Brevo configuration fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS brevo_api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brevo_sender_email TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN organizations.brevo_api_key IS 'Organization-specific Brevo API key for sending emails';
COMMENT ON COLUMN organizations.brevo_sender_email IS 'Verified sender email address in Brevo';