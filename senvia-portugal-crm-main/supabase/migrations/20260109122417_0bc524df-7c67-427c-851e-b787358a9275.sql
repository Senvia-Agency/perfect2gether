-- Função para buscar formulário por slug (URLs amigáveis)
CREATE OR REPLACE FUNCTION public.get_public_form_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  form_settings jsonb,
  public_key uuid,
  meta_pixels jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, name, form_settings, public_key, meta_pixels
  FROM public.organizations
  WHERE slug = _slug
$$;

-- Dar permissões para utilizadores anónimos e autenticados
GRANT EXECUTE ON FUNCTION public.get_public_form_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_form_by_slug(text) TO authenticated;

-- Função para obter slug a partir do public_key (para redirects legacy)
CREATE OR REPLACE FUNCTION public.get_slug_by_public_key(_public_key uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT slug
  FROM public.organizations
  WHERE public_key = _public_key
$$;

GRANT EXECUTE ON FUNCTION public.get_slug_by_public_key(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_slug_by_public_key(uuid) TO authenticated;