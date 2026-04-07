
-- Remover constraint antiga e adicionar nova que inclui starter/pro/elite
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('starter', 'pro', 'elite', 'basic', 'professional', 'enterprise'));

-- Agora atualizar organizações existentes
UPDATE public.organizations SET plan = 'starter' WHERE plan = 'basic' OR plan IS NULL;
