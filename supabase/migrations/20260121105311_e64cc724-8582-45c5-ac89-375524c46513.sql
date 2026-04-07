-- Adicionar campo de atribuição automática aos formulários
ALTER TABLE forms 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Comentário para documentação
COMMENT ON COLUMN forms.assigned_to IS 'Colaborador padrão para leads deste formulário';