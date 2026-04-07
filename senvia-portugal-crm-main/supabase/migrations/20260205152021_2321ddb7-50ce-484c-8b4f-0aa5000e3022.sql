-- Adicionar campo de recorrência aos produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Adicionar campos de recorrência às vendas
ALTER TABLE sales ADD COLUMN IF NOT EXISTS has_recurring BOOLEAN DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS recurring_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS recurring_status TEXT DEFAULT 'active';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS next_renewal_date DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS last_renewal_date DATE;

-- Índice para buscar vendas com renovação pendente
CREATE INDEX IF NOT EXISTS idx_sales_next_renewal ON sales(next_renewal_date) WHERE has_recurring = true AND recurring_status = 'active';