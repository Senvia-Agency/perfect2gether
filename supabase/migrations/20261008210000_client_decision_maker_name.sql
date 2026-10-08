-- Preserve legacy client and company tax IDs; keep older records compatible.
ALTER TABLE public.crm_clients
ADD COLUMN IF NOT EXISTS decision_maker_name text;
COMMENT ON COLUMN public.crm_clients.decision_maker_name
IS 'Name of the decision maker or contact; required in P2G client create/edit forms.';
