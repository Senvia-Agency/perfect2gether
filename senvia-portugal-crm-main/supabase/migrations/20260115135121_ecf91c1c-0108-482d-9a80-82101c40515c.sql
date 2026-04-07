-- =====================================================
-- 1. ADICIONAR CÓDIGOS ÚNICOS (CLI-0001, PROP-0001, VND-0001)
-- =====================================================

-- Adicionar coluna code às tabelas
ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_clients_code ON crm_clients(code);
CREATE INDEX IF NOT EXISTS idx_proposals_code ON proposals(code);
CREATE INDEX IF NOT EXISTS idx_sales_code ON sales(code);

-- Função para gerar código de cliente
CREATE OR REPLACE FUNCTION generate_client_code(_org_id uuid)
RETURNS text AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM crm_clients
  WHERE organization_id = _org_id AND code IS NOT NULL;
  
  RETURN 'CLI-' || LPAD(_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar código de proposta
CREATE OR REPLACE FUNCTION generate_proposal_code(_org_id uuid)
RETURNS text AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM proposals
  WHERE organization_id = _org_id AND code IS NOT NULL;
  
  RETURN 'PROP-' || LPAD(_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar código de venda
CREATE OR REPLACE FUNCTION generate_sale_code(_org_id uuid)
RETURNS text AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM sales
  WHERE organization_id = _org_id AND code IS NOT NULL;
  
  RETURN 'VND-' || LPAD(_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para clientes
CREATE OR REPLACE FUNCTION set_client_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_client_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_client_code ON crm_clients;
CREATE TRIGGER trigger_set_client_code
  BEFORE INSERT ON crm_clients
  FOR EACH ROW EXECUTE FUNCTION set_client_code();

-- Trigger para propostas
CREATE OR REPLACE FUNCTION set_proposal_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_proposal_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_proposal_code ON proposals;
CREATE TRIGGER trigger_set_proposal_code
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION set_proposal_code();

-- Trigger para vendas
CREATE OR REPLACE FUNCTION set_sale_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_sale_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_sale_code ON sales;
CREATE TRIGGER trigger_set_sale_code
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION set_sale_code();

-- Gerar códigos para registos existentes
UPDATE crm_clients SET code = generate_client_code(organization_id) WHERE code IS NULL;
UPDATE proposals SET code = generate_proposal_code(organization_id) WHERE code IS NULL;
UPDATE sales SET code = generate_sale_code(organization_id) WHERE code IS NULL;

-- =====================================================
-- 2. MELHORAR TABELA SALES COM NOVOS CAMPOS
-- =====================================================

-- Novos campos para vendas
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_date DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_reference TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;

-- =====================================================
-- 3. CRIAR TABELA SALE_ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- RLS
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sale_items
CREATE POLICY "Super admin full access sale_items"
  ON sale_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users view org sale items"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id 
      AND s.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Users manage org sale items"
  ON sale_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id 
      AND s.organization_id = get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id 
      AND s.organization_id = get_user_org_id(auth.uid())
    )
  );