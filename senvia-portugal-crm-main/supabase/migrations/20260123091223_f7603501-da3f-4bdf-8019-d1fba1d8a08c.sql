-- Add logo_url column to organizations for dashboard branding
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;