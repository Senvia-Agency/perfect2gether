-- Atualizar função generate_client_code para usar apenas números (4 dígitos)
CREATE OR REPLACE FUNCTION generate_client_code(_org_id uuid)
RETURNS text AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM crm_clients
  WHERE organization_id = _org_id AND code IS NOT NULL;
  
  RETURN LPAD(_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atualizar função generate_proposal_code para usar apenas números
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
  
  RETURN LPAD(_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atualizar função generate_sale_code para usar apenas números
CREATE OR REPLACE FUNCTION generate_sale_code(_org_id uuid)
RETURNS TEXT AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM sales
  WHERE organization_id = _org_id AND code IS NOT NULL;
  
  RETURN LPAD(_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Converter códigos existentes de clientes (extrair números e formatar com 4 dígitos)
UPDATE crm_clients 
SET code = LPAD(
  CAST(regexp_replace(code, '[^0-9]', '', 'g') AS INTEGER)::TEXT, 
  4, '0'
)
WHERE code IS NOT NULL AND regexp_replace(code, '[^0-9]', '', 'g') != '';

-- Converter códigos existentes de propostas
UPDATE proposals 
SET code = LPAD(
  CAST(regexp_replace(code, '[^0-9]', '', 'g') AS INTEGER)::TEXT, 
  4, '0'
)
WHERE code IS NOT NULL AND regexp_replace(code, '[^0-9]', '', 'g') != '';

-- Converter códigos existentes de vendas
UPDATE sales 
SET code = LPAD(
  CAST(regexp_replace(code, '[^0-9]', '', 'g') AS INTEGER)::TEXT, 
  4, '0'
)
WHERE code IS NOT NULL AND regexp_replace(code, '[^0-9]', '', 'g') != '';