-- Adicionar novo role "salesperson" (vendedor)
ALTER TYPE app_role ADD VALUE 'salesperson';

-- Adicionar coluna assigned_to na tabela leads
ALTER TABLE public.leads 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);

-- Remover policy existente de leitura
DROP POLICY IF EXISTS "Users read org leads" ON public.leads;

-- Nova policy: Admins veem todos, vendedores/viewers veem apenas os seus ou não atribuídos
CREATE POLICY "Users read org leads v2" ON public.leads
FOR SELECT
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (
    -- Admins e super_admins veem tudo da organização
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'super_admin')
    -- Vendedores/viewers veem apenas leads atribuídos a si OU não atribuídos
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  )
);