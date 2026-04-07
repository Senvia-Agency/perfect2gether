
-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- Immutable wrapper
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent($1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = 'public';

-- 1. Search clients
CREATE OR REPLACE FUNCTION public.search_clients_unaccent(
  org_id uuid, search_term text, max_results int DEFAULT 10
) RETURNS SETOF crm_clients AS $$
  SELECT * FROM crm_clients
  WHERE organization_id = org_id
    AND (
      immutable_unaccent(lower(name)) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(email,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(nif,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(company,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
    )
  LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';

-- 2. Search leads
CREATE OR REPLACE FUNCTION public.search_leads_unaccent(
  org_id uuid, search_term text, lead_status text DEFAULT NULL, max_results int DEFAULT 10
) RETURNS SETOF leads AS $$
  SELECT * FROM leads
  WHERE organization_id = org_id
    AND (lead_status IS NULL OR status = lead_status)
    AND (
      immutable_unaccent(lower(name)) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(email,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(phone,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(company_name,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
    )
  LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';

-- 3. Search invoices
CREATE OR REPLACE FUNCTION public.search_invoices_unaccent(
  org_id uuid, search_term text, inv_status text DEFAULT NULL, max_results int DEFAULT 10
) RETURNS SETOF invoices AS $$
  SELECT * FROM invoices
  WHERE organization_id = org_id
    AND (inv_status IS NULL OR status = inv_status)
    AND (
      immutable_unaccent(lower(COALESCE(client_name,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(reference,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
    )
  LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';

-- 4. Search sales
CREATE OR REPLACE FUNCTION public.search_sales_unaccent(
  org_id uuid, search_term text, pay_status text DEFAULT NULL, max_results int DEFAULT 10
) RETURNS SETOF sales AS $$
  SELECT * FROM sales
  WHERE organization_id = org_id
    AND (pay_status IS NULL OR payment_status = pay_status)
    AND (
      immutable_unaccent(lower(COALESCE(code,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(notes,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(invoice_reference,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
    )
  LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';

-- 5. Search proposals
CREATE OR REPLACE FUNCTION public.search_proposals_unaccent(
  org_id uuid, search_term text, prop_status text DEFAULT NULL, max_results int DEFAULT 10
) RETURNS SETOF proposals AS $$
  SELECT * FROM proposals
  WHERE organization_id = org_id
    AND (prop_status IS NULL OR status = prop_status)
    AND (
      immutable_unaccent(lower(COALESCE(code,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
      OR immutable_unaccent(lower(COALESCE(notes,''))) LIKE '%' || immutable_unaccent(lower(search_term)) || '%'
    )
  LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';
