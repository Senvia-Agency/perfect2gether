-- Add meta_pixels column to forms table
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS meta_pixels JSONB DEFAULT '[]'::jsonb;

-- Migrate existing pixels from organizations to default forms
UPDATE public.forms f
SET meta_pixels = o.meta_pixels
FROM public.organizations o
WHERE f.organization_id = o.id
  AND f.is_default = true
  AND o.meta_pixels IS NOT NULL
  AND o.meta_pixels != '[]'::jsonb;

-- Update get_form_by_slugs to return form-level meta_pixels with fallback
CREATE OR REPLACE FUNCTION public.get_form_by_slugs(_org_slug text, _form_slug text DEFAULT NULL::text)
 RETURNS TABLE(form_id uuid, form_name text, form_settings jsonb, org_id uuid, org_name text, org_slug text, meta_pixels jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    f.id as form_id,
    f.name as form_name,
    f.form_settings,
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    COALESCE(NULLIF(f.meta_pixels, '[]'::jsonb), o.meta_pixels) as meta_pixels
  FROM public.forms f
  JOIN public.organizations o ON o.id = f.organization_id
  WHERE o.slug = _org_slug
    AND f.is_active = true
    AND (
      (_form_slug IS NOT NULL AND f.slug = _form_slug)
      OR (_form_slug IS NULL AND f.is_default = true)
    )
  LIMIT 1
$function$;