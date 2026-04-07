-- Remove the UNIQUE constraint on code column
ALTER TABLE crm_clients DROP CONSTRAINT IF EXISTS crm_clients_code_key;

-- Create composite UNIQUE index (organization_id + code)
-- This allows each organization to have its own sequence of client codes
CREATE UNIQUE INDEX crm_clients_org_code_unique 
ON crm_clients(organization_id, code) 
WHERE code IS NOT NULL;