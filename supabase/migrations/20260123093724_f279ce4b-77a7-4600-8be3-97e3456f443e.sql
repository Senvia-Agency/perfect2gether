-- Add proposal type fields to proposals table
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS proposal_type TEXT DEFAULT 'energia',
ADD COLUMN IF NOT EXISTS consumo_anual NUMERIC,
ADD COLUMN IF NOT EXISTS margem NUMERIC,
ADD COLUMN IF NOT EXISTS dbl BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS anos_contrato INTEGER,
ADD COLUMN IF NOT EXISTS comissao NUMERIC,
ADD COLUMN IF NOT EXISTS modelo_servico TEXT,
ADD COLUMN IF NOT EXISTS kwp NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN public.proposals.proposal_type IS 'Type of proposal: energia or servicos';
COMMENT ON COLUMN public.proposals.consumo_anual IS 'Annual consumption in kWh (Energia only)';
COMMENT ON COLUMN public.proposals.margem IS 'Margin in EUR (Energia only)';
COMMENT ON COLUMN public.proposals.dbl IS 'Dual Bill - Electricity + Gas (Energia only)';
COMMENT ON COLUMN public.proposals.anos_contrato IS 'Contract duration in years (Energia only)';
COMMENT ON COLUMN public.proposals.comissao IS 'Commission value in EUR';
COMMENT ON COLUMN public.proposals.modelo_servico IS 'Service model: transacional or saas (Servicos only)';
COMMENT ON COLUMN public.proposals.kwp IS 'Photovoltaic power in kWp (Servicos only)';