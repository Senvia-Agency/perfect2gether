-- Os triggers que geram o código (cliente, proposta, venda) não fixavam o search_path e chamavam
-- generate_*_code sem schema. Dentro de funções com SET search_path = '' (create_client_with_people,
-- convert_p2g_lead_to_client, ...) o INSERT falhava com "function generate_client_code(uuid) does not exist".
-- Fixar o search_path e qualificar as chamadas torna os triggers independentes de quem faz o INSERT.

CREATE OR REPLACE FUNCTION public.set_client_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.generate_client_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_proposal_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.generate_proposal_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_sale_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.generate_sale_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;
