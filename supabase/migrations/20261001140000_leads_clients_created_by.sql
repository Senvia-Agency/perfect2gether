-- Regista quem criou cada lead e cada cliente. Preenchido automaticamente com o
-- utilizador autenticado; registos antigos e os criados por integrações ficam a NULL.
-- Default definido à parte para não reescrever as tabelas existentes
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.leads ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.crm_clients ALTER COLUMN created_by SET DEFAULT auth.uid();

-- O valor é definido na criação e não pode ser alterado depois
CREATE OR REPLACE FUNCTION public.keep_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_leads_created_by ON public.leads;
CREATE TRIGGER keep_leads_created_by
BEFORE UPDATE OF created_by ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.keep_created_by();

DROP TRIGGER IF EXISTS keep_crm_clients_created_by ON public.crm_clients;
CREATE TRIGGER keep_crm_clients_created_by
BEFORE UPDATE OF created_by ON public.crm_clients
FOR EACH ROW EXECUTE FUNCTION public.keep_created_by();

NOTIFY pgrst, 'reload schema';
