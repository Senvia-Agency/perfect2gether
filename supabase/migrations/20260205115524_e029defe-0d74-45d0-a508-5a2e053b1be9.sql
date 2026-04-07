-- Tabela de categorias de despesas
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para categorias
CREATE INDEX idx_expense_categories_org ON expense_categories(organization_id);

-- RLS para categorias
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org expense categories" ON expense_categories
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org expense categories" ON expense_categories
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access expense_categories" ON expense_categories
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Tabela de despesas
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  notes TEXT,
  receipt_file_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para despesas
CREATE INDEX idx_expenses_org ON expenses(organization_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category_id);

-- RLS para despesas
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org expenses" ON expenses
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users insert org expenses" ON expenses
  FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org expenses" ON expenses
  FOR UPDATE USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org expenses" ON expenses
  FOR DELETE USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access expenses" ON expenses
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger updated_at para categorias
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger updated_at para despesas
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();