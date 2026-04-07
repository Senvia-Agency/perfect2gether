CREATE OR REPLACE FUNCTION public.search_credit_notes_unaccent(
  org_id uuid,
  search_term text,
  cn_status text DEFAULT NULL,
  max_results int DEFAULT 10
) RETURNS SETOF credit_notes AS $$
  SELECT * FROM credit_notes
  WHERE organization_id = org_id
    AND (cn_status IS NULL OR status = cn_status)
    AND (
      immutable_unaccent(lower(COALESCE(reference, '')))
        LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(client_name, '')))
        LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
    )
  ORDER BY date DESC NULLS LAST
  LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';