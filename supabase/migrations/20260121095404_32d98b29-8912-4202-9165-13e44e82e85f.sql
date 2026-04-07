-- 1. PROPOSALS: Remover constraint global (é uma constraint, não apenas index)
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_code_key;

-- 2. PROPOSALS: Criar index composto (organization_id + code)
CREATE UNIQUE INDEX proposals_org_code_unique 
ON proposals(organization_id, code) 
WHERE code IS NOT NULL;

-- 3. SALES: Remover constraint global  
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_code_key;

-- 4. SALES: Criar index composto (organization_id + code)
CREATE UNIQUE INDEX sales_org_code_unique 
ON sales(organization_id, code) 
WHERE code IS NOT NULL;