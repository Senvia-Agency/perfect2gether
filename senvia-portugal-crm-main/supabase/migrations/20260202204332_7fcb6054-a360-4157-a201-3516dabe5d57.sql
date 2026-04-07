-- Remove o CHECK CONSTRAINT antigo que está desatualizado
-- O sistema agora usa pipeline_stages dinâmico em vez de status fixos
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;