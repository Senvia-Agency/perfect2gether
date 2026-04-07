-- Drop existing function first (return type change requires this)
DROP FUNCTION IF EXISTS public.get_form_by_slugs(text, text);

-- Recreate with public_key included
CREATE OR REPLACE FUNCTION public.get_form_by_slugs(_org_slug text, _form_slug text DEFAULT NULL::text)
 RETURNS TABLE(
   form_id uuid, 
   form_name text, 
   form_settings jsonb, 
   org_id uuid, 
   org_name text, 
   org_slug text, 
   meta_pixels jsonb,
   public_key uuid
 )
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
    COALESCE(NULLIF(f.meta_pixels, '[]'::jsonb), o.meta_pixels) as meta_pixels,
    o.public_key
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