-- RLS: leads passam a respeitar lideres de equipa.
--
-- A policy "Users read org leads v2" so reconhecia admin / proprio / nao-atribuido;
-- um lider de equipa (perfil data_scope = 'team') NAO via os leads da sua equipa.
-- Passa a usar app_can_view_user_data (criada em 20260522163000), que cobre
-- admin / proprio / equipa. Mantem-se a visibilidade de leads nao atribuidos.
--
-- Aplicado em producao em 2026-05-22 via API de gestao Supabase.

alter policy "Users read org leads v2" on public.leads
  using (organization_id = get_user_org_id(auth.uid())
         and (app_can_view_user_data(assigned_to) or assigned_to is null));

-- ROLLBACK:
-- alter policy "Users read org leads v2" on public.leads
--   using (organization_id = get_user_org_id(auth.uid())
--          and (has_role(auth.uid(), 'admin'::app_role)
--               or has_role(auth.uid(), 'super_admin'::app_role)
--               or assigned_to = auth.uid()
--               or assigned_to is null));
