-- Remover constraint antiga
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Criar nova constraint com 'proposal' incluído
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status = ANY (ARRAY['new', 'contacted', 'scheduled', 'proposal', 'won', 'lost']));