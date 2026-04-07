CREATE OR REPLACE FUNCTION public.search_organizations_by_name(_caller_org_id uuid, _search text, _limit integer DEFAULT 10)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.name, o.slug
  FROM public.organizations o
  WHERE o.id != _caller_org_id
    AND immutable_unaccent(lower(o.name)) LIKE '%' || immutable_unaccent(lower(_search)) || '%'
  LIMIT _limit;
$$;