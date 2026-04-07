-- Create client_communications table
CREATE TABLE client_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_by uuid,
  
  -- Tipo de comunicação
  type text NOT NULL CHECK (type IN ('call', 'whatsapp', 'email', 'note')),
  
  -- Direção (entrada/saída)
  direction text CHECK (direction IN ('inbound', 'outbound')),
  
  -- Conteúdo
  subject text,
  content text,
  
  -- Duração (para chamadas, em segundos)
  duration_seconds integer,
  
  -- Timestamps
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_client_communications_client ON client_communications(client_id);
CREATE INDEX idx_client_communications_org ON client_communications(organization_id);
CREATE INDEX idx_client_communications_occurred ON client_communications(occurred_at DESC);

-- RLS Policies
ALTER TABLE client_communications ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access client_communications"
ON client_communications FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Users view org communications
CREATE POLICY "Users view org client_communications"
ON client_communications FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

-- Users insert org communications
CREATE POLICY "Users insert org client_communications"
ON client_communications FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

-- Users update org communications
CREATE POLICY "Users update org client_communications"
ON client_communications FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()));

-- Admins delete org communications
CREATE POLICY "Admins delete org client_communications"
ON client_communications FOR DELETE
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);