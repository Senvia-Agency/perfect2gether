-- Regras operacionais P2G:
-- 1. Apenas Back Office (ou perfis admin) pode alterar o estado de uma venda.
-- 2. Back Office/admin pode criar uma marcação na agenda do comercial a quem
--    a lead está atribuída.

create or replace function public.enforce_sale_status_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_name text;
  v_base_role text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if has_role(auth.uid(), 'super_admin'::app_role)
     or has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;

  select op.name, op.base_role
    into v_profile_name, v_base_role
  from public.organization_members om
  left join public.organization_profiles op on op.id = om.profile_id
  where om.user_id = auth.uid()
    and om.organization_id = new.organization_id
  limit 1;

  if v_base_role = 'admin' or v_profile_name = 'Back Office' then
    return new;
  end if;

  raise exception 'Apenas o Back Office pode alterar o estado das vendas';
end;
$$;

drop trigger if exists trg_enforce_sale_status_manager on public.sales;
create trigger trg_enforce_sale_status_manager
  before update of status on public.sales
  for each row execute function public.enforce_sale_status_manager();

-- A proposta EDP é obrigatória para novos contratos de energia da P2G. A
-- validação na interface melhora a experiência; este trigger impede que outro
-- fluxo/API contorne a regra.
create or replace function public.enforce_p2g_energy_sale_edp_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
     and coalesce(new.proposal_type, 'energia') = 'energia'
     and nullif(btrim(coalesce(new.edp_proposal_number, '')), '') is null then
    raise exception 'O código da proposta EDP é obrigatório para contratos de energia';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_p2g_energy_sale_edp_code on public.sales;
create trigger trg_enforce_p2g_energy_sale_edp_code
  before insert or update of proposal_type, edp_proposal_number on public.sales
  for each row execute function public.enforce_p2g_energy_sale_edp_code();

-- Corrige vendas já existentes criadas a partir de propostas: antes, o lead_id
-- não era copiado para sales e o comercial atribuído deixava de as ver.
update public.sales s
set lead_id = coalesce(
  p.lead_id,
  (select c.lead_id from public.crm_clients c where c.id = s.client_id)
)
from public.proposals p
where s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  and s.lead_id is null
  and s.proposal_id = p.id
  and coalesce(
    p.lead_id,
    (select c.lead_id from public.crm_clients c where c.id = s.client_id)
  ) is not null;

-- Move para a agenda do comercial responsável as marcações pendentes que foram
-- criadas pelo Back Office para uma lead já atribuída.
update public.calendar_events e
set user_id = l.assigned_to
from public.leads l
where e.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  and e.lead_id = l.id
  and e.status = 'pending'
  and l.assigned_to is not null
  and e.user_id is distinct from l.assigned_to;

drop policy if exists "Users insert own events" on public.calendar_events;
create policy "Users insert own or assigned events" on public.calendar_events
for insert to authenticated
with check (
  organization_id = get_user_org_id(auth.uid())
  and exists (
    select 1
    from public.organization_members target_member
    where target_member.organization_id = calendar_events.organization_id
      and target_member.user_id = calendar_events.user_id
  )
  and (
    user_id = auth.uid()
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
    or exists (
      select 1
      from public.organization_members om
      join public.organization_profiles op on op.id = om.profile_id
      where om.user_id = auth.uid()
        and om.organization_id = calendar_events.organization_id
        and (op.name = 'Back Office' or op.base_role = 'admin')
    )
  )
);
