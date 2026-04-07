-- Adicionar tipo de negociação à tabela proposals
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS negotiation_type text DEFAULT NULL;

-- Adicionar produtos selecionados para serviços (checkboxes)
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS servicos_produtos text[] DEFAULT NULL;

-- Adicionar campos de energia a cada CPE (proposal_cpes)
ALTER TABLE proposal_cpes 
ADD COLUMN IF NOT EXISTS consumo_anual numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS duracao_contrato integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dbl numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS margem numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comissao numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contrato_inicio date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contrato_fim date DEFAULT NULL;