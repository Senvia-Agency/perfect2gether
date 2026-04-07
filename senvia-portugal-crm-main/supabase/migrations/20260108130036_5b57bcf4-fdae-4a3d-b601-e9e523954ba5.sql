-- Add meta_pixels column to organizations table for Meta Ads Pixel integration
ALTER TABLE public.organizations
ADD COLUMN meta_pixels jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.meta_pixels IS 'Array of Meta Ads Pixels with structure: [{id, name, pixel_id, enabled}]';