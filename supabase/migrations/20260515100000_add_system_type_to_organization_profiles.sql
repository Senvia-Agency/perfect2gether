-- Add systems array to organization_profiles (supports multiple: p2g, total_link, or both)
ALTER TABLE organization_profiles
  ADD COLUMN IF NOT EXISTS systems text[] NOT NULL DEFAULT '{p2g}';

-- Comment
COMMENT ON COLUMN organization_profiles.systems IS 'Systems this profile grants access to: p2g, total_link, or both';
