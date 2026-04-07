-- Simplificar formato do código de propostas de PROP-0001 para P001
CREATE OR REPLACE FUNCTION generate_proposal_code(_org_id uuid)
RETURNS TEXT AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM proposals
  WHERE organization_id = _org_id AND code IS NOT NULL;
  
  -- Formato simplificado: P001, P002, etc.
  RETURN 'P' || LPAD(_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;