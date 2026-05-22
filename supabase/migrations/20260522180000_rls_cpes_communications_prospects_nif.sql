-- Completa o escopo de dados: cpes, client_communications, prospects.
-- + RPC para verificacao de NIF duplicado a nivel da organizacao.
--
-- cpes (equipamentos) e client_communications (comunicacoes) tinham SELECT
-- apenas por organization_id — qualquer membro lia os de qualquer cliente.
-- prospects tinha SELECT org-wide (e duas policies SELECT redundantes).
--
-- Aplicado em producao em 2026-05-22 via API de gestao Supabase.

-- ── Funcoes ────────────────────────────────────────────────────────

-- Posso ver este cliente? (delega no escopo de crm_clients.assigned_to)
create or replace function public.app_can_view_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    p_client_id is not null
    and exists (
      select 1 from crm_clients c
      where c.id = p_client_id and public.app_can_view_user_data(c.assigned_to)
    ), false);
$fn$;

-- Verificacao de NIF duplicado em TODA a organizacao. SECURITY DEFINER para
-- contornar o RLS de crm_clients de forma controlada (deriva a org de auth.uid,
-- o chamador nao pode sondar outras organizacoes).
create or replace function public.check_nif_exists(p_nif text, p_exclude_client_id uuid default null)
returns table(id uuid, name text, code text)
language sql stable security definer set search_path = public as $fn$
  select c.id, c.name, c.code
  from crm_clients c
  where c.organization_id = get_user_org_id(auth.uid())
    and (c.nif = p_nif or c.company_nif = p_nif)
    and (p_exclude_client_id is null or c.id <> p_exclude_client_id)
  limit 1;
$fn$;

-- ── Policies de SELECT ─────────────────────────────────────────────

alter policy "Users view org cpes" on public.cpes
  using (organization_id = get_user_org_id(auth.uid()) and app_can_view_client(client_id));

alter policy "Users view org client_communications" on public.client_communications
  using (organization_id = get_user_org_id(auth.uid()) and app_can_view_client(client_id));

-- prospects tem duas policies SELECT redundantes — ambas escopadas por assigned_to
alter policy "Prospects are viewable by org members or super admins" on public.prospects
  using (is_org_member(auth.uid(), organization_id) and app_can_view_user_data(assigned_to));
alter policy "Org members can view prospects" on public.prospects
  using (is_org_member(auth.uid(), organization_id) and app_can_view_user_data(assigned_to));

-- ── ROLLBACK ───────────────────────────────────────────────────────
-- alter policy "Users view org cpes" on public.cpes
--   using (organization_id = get_user_org_id(auth.uid()));
-- alter policy "Users view org client_communications" on public.client_communications
--   using (organization_id = get_user_org_id(auth.uid()));
-- alter policy "Prospects are viewable by org members or super admins" on public.prospects
--   using (is_org_member(auth.uid(), organization_id) or has_role(auth.uid(), 'super_admin'::app_role));
-- alter policy "Org members can view prospects" on public.prospects
--   using (is_org_member(auth.uid(), organization_id));
