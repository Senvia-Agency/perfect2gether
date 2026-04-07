-- Add proposal-specific fields to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS proposal_type text,
ADD COLUMN IF NOT EXISTS consumo_anual numeric,
ADD COLUMN IF NOT EXISTS margem numeric,
ADD COLUMN IF NOT EXISTS dbl numeric,
ADD COLUMN IF NOT EXISTS anos_contrato integer,
ADD COLUMN IF NOT EXISTS modelo_servico text,
ADD COLUMN IF NOT EXISTS kwp numeric,
ADD COLUMN IF NOT EXISTS comissao numeric;