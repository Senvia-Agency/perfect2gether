-- Create a public function to get form settings by public key
-- This allows anonymous users to access only the necessary form data
CREATE OR REPLACE FUNCTION public.get_public_form_by_key(_public_key uuid)
RETURNS TABLE (
  id uuid,
  name text,
  form_settings jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, name, form_settings
  FROM public.organizations
  WHERE public_key = _public_key
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_form_by_key(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_form_by_key(uuid) TO authenticated;