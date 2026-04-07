-- Add fidelization alert configuration to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS fidelization_alert_days jsonb DEFAULT '[30, 7]'::jsonb,
ADD COLUMN IF NOT EXISTS fidelization_create_event boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS fidelization_event_time time DEFAULT '10:00:00',
ADD COLUMN IF NOT EXISTS fidelization_email_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fidelization_email text DEFAULT NULL;

-- Add alert tracking fields to cpes
ALTER TABLE public.cpes
ADD COLUMN IF NOT EXISTS alert_30d_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS alert_7d_sent boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.fidelization_alert_days IS 'Array of days before expiration to send alerts, e.g. [30, 7]';
COMMENT ON COLUMN public.organizations.fidelization_create_event IS 'Whether to create calendar events for renewal visits';
COMMENT ON COLUMN public.organizations.fidelization_event_time IS 'Default time for calendar events';
COMMENT ON COLUMN public.organizations.fidelization_email_enabled IS 'Whether to send email alerts';
COMMENT ON COLUMN public.organizations.fidelization_email IS 'Email address to receive fidelization alerts';
COMMENT ON COLUMN public.cpes.alert_30d_sent IS 'Whether the 30-day alert has been sent';
COMMENT ON COLUMN public.cpes.alert_7d_sent IS 'Whether the 7-day alert has been sent';