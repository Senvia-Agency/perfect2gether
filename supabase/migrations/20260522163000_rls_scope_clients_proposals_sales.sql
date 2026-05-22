-- Escopo de dados via RLS: clientes, propostas, vendas e pagamentos.
--
-- PROBLEMA
--   crm_clients / proposals / sales / sale_payments tinham a policy de SELECT
--   apenas como `organization_id = get_user_org_id(auth.uid())`. Ou seja, qualquer
--   membro da organizacao (incluindo um comercial) conseguia ler TODOS os registos
--   da org diretamente pela API. O escopo "so os meus" existia apenas no frontend.
--
-- SOLUCAO
--   SELECT escopado por propriedade, espelhando a logica do hook useTeamFilter:
--     * admin / super_admin             -> toda a organizacao
--     * lider de equipa (perfil data_scope = 'team') -> os seus + os da sua equipa
--     * restantes                       -> apenas os seus
--   A tabela `leads` ja estava escopada e NAO e alterada aqui.
--
-- Aplicado em producao em 2026-05-22 via API de gestao Supabase e validado
-- simulando cada utilizador (admin, own, lider de equipa, team-sem-equipa).

-- ── Funcoes de escopo (SECURITY DEFINER: ignoram RLS das tabelas auxiliares) ──

create or replace function public.app_can_view_user_data(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
    or target_user = auth.uid()
    or (
      exists (
        select 1 from organization_members om
        join organization_profiles op on op.id = om.profile_id
        where om.user_id = auth.uid()
          and om.organization_id = get_user_org_id(auth.uid())
          and op.data_scope = 'team'
      )
      and exists (
        select 1 from teams t
        join team_members tm on tm.team_id = t.id
        where t.leader_id = auth.uid() and tm.user_id = target_user
      )
    ), false);
$fn$;

create or replace function public.app_can_view_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    p_lead_id is not null
    and exists (
      select 1 from leads l
      where l.id = p_lead_id and public.app_can_view_user_data(l.assigned_to)
    ), false);
$fn$;

create or replace function public.app_can_view_sale(p_sale_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    p_sale_id is not null
    and exists (
      select 1 from sales s
      where s.id = p_sale_id
        and (public.app_can_view_user_data(s.created_by) or public.app_can_view_lead(s.lead_id))
    ), false);
$fn$;

-- ── Policies de SELECT (ALTER mantem cmd/roles/permissive) ──

alter policy "Users view org clients" on public.crm_clients
  using (organization_id = get_user_org_id(auth.uid()) and app_can_view_user_data(assigned_to));

alter policy "Users view org proposals" on public.proposals
  using (organization_id = get_user_org_id(auth.uid())
         and (app_can_view_user_data(created_by) or app_can_view_lead(lead_id)));

alter policy "Users view org sales" on public.sales
  using (organization_id = get_user_org_id(auth.uid())
         and (app_can_view_user_data(created_by) or app_can_view_lead(lead_id)));

alter policy "Users can view their org payments" on public.sale_payments
  using (organization_id = get_user_org_id(auth.uid()) and app_can_view_sale(sale_id));

-- ── ROLLBACK (se necessario, repor o escopo apenas-organizacao) ──
-- alter policy "Users view org clients" on public.crm_clients
--   using (organization_id = get_user_org_id(auth.uid()));
-- alter policy "Users view org proposals" on public.proposals
--   using (organization_id = get_user_org_id(auth.uid()));
-- alter policy "Users view org sales" on public.sales
--   using (organization_id = get_user_org_id(auth.uid()));
-- alter policy "Users can view their org payments" on public.sale_payments
--   using (organization_id = get_user_org_id(auth.uid()));
