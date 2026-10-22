-- Several decision makers per client, each with name, role, phone and email.
-- Stored on crm_clients so the existing RLS policies apply unchanged.
-- decision_maker_name is kept and mirrors the first decision maker.
ALTER TABLE public.crm_clients
ADD COLUMN IF NOT EXISTS decision_makers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.crm_clients
DROP CONSTRAINT IF EXISTS crm_clients_decision_makers_is_array;
ALTER TABLE public.crm_clients
ADD CONSTRAINT crm_clients_decision_makers_is_array CHECK (jsonb_typeof(decision_makers) = 'array');

COMMENT ON COLUMN public.crm_clients.decision_makers
IS 'Array of {name, role, phone, email}; edited in the P2G client form. decision_maker_name mirrors the first name.';

UPDATE public.crm_clients
SET decision_makers = jsonb_build_array(jsonb_build_object(
  'name', btrim(decision_maker_name), 'role', '', 'phone', '', 'email', ''))
WHERE decision_makers = '[]'::jsonb
  AND nullif(btrim(decision_maker_name), '') IS NOT NULL;
