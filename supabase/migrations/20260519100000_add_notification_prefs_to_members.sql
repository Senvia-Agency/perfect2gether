-- Add per-user notification preferences to organization_members
-- These are managed by admin when creating/editing team members

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"calendar": true, "email": true, "fidelization": true}'::jsonb;

COMMENT ON COLUMN organization_members.notification_email IS 'Email where this user receives notification alerts (overrides profile email)';
COMMENT ON COLUMN organization_members.notification_preferences IS 'Per-user notification toggles: push, calendar, email, fidelization';
