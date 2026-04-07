-- Add assigned_to column to crm_clients table
ALTER TABLE crm_clients 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN crm_clients.assigned_to IS 'Vendedor responsável pelo cliente';