-- Adicionar campos de automação à tabela forms
ALTER TABLE public.forms ADD COLUMN msg_template_hot TEXT;
ALTER TABLE public.forms ADD COLUMN msg_template_warm TEXT;
ALTER TABLE public.forms ADD COLUMN msg_template_cold TEXT;
ALTER TABLE public.forms ADD COLUMN ai_qualification_rules TEXT;

-- Migrar dados existentes das organizações para os formulários default
UPDATE public.forms f
SET 
  msg_template_hot = o.msg_template_hot,
  msg_template_warm = o.msg_template_warm,
  msg_template_cold = o.msg_template_cold,
  ai_qualification_rules = o.ai_qualification_rules
FROM public.organizations o
WHERE f.organization_id = o.id
  AND f.is_default = true;