-- Add address fields to crm_clients
ALTER TABLE crm_clients ADD COLUMN address_line1 TEXT;
ALTER TABLE crm_clients ADD COLUMN address_line2 TEXT;
ALTER TABLE crm_clients ADD COLUMN city TEXT;
ALTER TABLE crm_clients ADD COLUMN postal_code TEXT;
ALTER TABLE crm_clients ADD COLUMN country TEXT DEFAULT 'PT';

-- Add client_id to calendar_events for associating meetings with clients
ALTER TABLE calendar_events ADD COLUMN client_id UUID REFERENCES crm_clients(id) ON DELETE SET NULL;