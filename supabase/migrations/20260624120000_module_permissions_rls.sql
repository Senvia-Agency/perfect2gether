-- ============================================================================
-- Enforcement de permissoes por modulo ao nivel da base de dados (RLS)
-- ============================================================================
--
-- CONTEXTO
--   As permissoes granulares por modulo/subarea/acao sao configuradas nos perfis
--   (organization_profiles.module_permissions, JSONB) e agora respeitadas na UI.
--   Esta migracao adiciona a camada de seguranca real: mesmo que alguem contorne
--   a interface e chame a API diretamente, a base de dados bloqueia escritas que
--   o perfil nao autoriza.
--
-- COMO FUNCIONA
--   1. has_module_permission(org, module, subarea, action): decide se o utilizador
--      atual pode executar uma acao de escrita num registo de uma organizacao.
--        - super_admin / admin (user_roles)                 -> SEMPRE permitido
--        - perfil com base_role = 'admin'                    -> SEMPRE permitido
--        - membro da org SEM perfil granular                 -> permitido (legado)
--        - perfil granular: le module_permissions[module].subareas[subarea][action]
--        - chave em falta num perfil granular                -> NEGADO (igual ao
--          comportamento do can() no frontend para nao-admins)
--      (compativel tambem com o formato legado plano {view,edit,delete}).
--
--   2. Politicas RESTRICTIVE apenas para INSERT / UPDATE / DELETE nas tabelas-topo
--      de cada modulo. RESTRICTIVE = e somado (AND) as politicas permissivas que ja
--      existem (isolamento por organizacao + data_scope), por isso NAO concede acesso
--      novo: apenas restringe. O SELECT nao e tocado (sem risco de esconder dados).
--
-- SEGURANCA / PORQUE E SEGURO CORRER
--   - Admins e super_admins nunca sao bloqueados (bypass na funcao).
--   - So mexe em escritas; leituras ficam exatamente como estao.
--   - Auto-protegido: salta tabelas que nao existam ou sem coluna organization_id
--     (emite NOTICE em vez de falhar). Idempotente (drop policy if exists).
--   - So tem efeito em tabelas onde a RLS ja esta ativa; nao ativa RLS em lado nenhum
--     (evita esconder dados sem querer). Edge Functions usam service_role e ignoram RLS.
--   - NAO cobre tabelas-filhas/derivadas por trigger (ex.: sale_items, comissoes,
--     historico) para nao partir fluxos que inserem registos como efeito secundario.
--
-- COMO TESTAR (recomendado antes de confiar)
--   1. Correr este SQL no Supabase SQL Editor.
--   2. Num perfil "Comercial" desligar, por exemplo, "Excluir Cliente"
--      (clients.list.delete) e "Remover da ficha" (clients.communications.delete).
--   3. Entrar com esse utilizador e confirmar que nao consegue apagar cliente nem
--      remover comunicacoes (nem pela UI nem via API). Admin continua a conseguir.
--
-- ROLLBACK
--   Ver bloco comentado no fim do ficheiro.
-- ============================================================================

-- ── 1. Funcao de decisao ────────────────────────────────────────────────────
create or replace function public.has_module_permission(
  _org uuid,
  _module text,
  _subarea text,
  _action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_perms jsonb;
  v_base text;
  v_val text;
begin
  -- Admin global / super_admin: bypass total.
  if has_role(auth.uid(), 'super_admin'::app_role)
     or has_role(auth.uid(), 'admin'::app_role) then
    return true;
  end if;

  -- Membro desta organizacao?
  select om.profile_id
    into v_profile_id
  from organization_members om
  where om.user_id = auth.uid()
    and om.organization_id = _org
  limit 1;

  if not found then
    -- Nao e membro desta org: o isolamento por org ja bloqueia; negamos tambem.
    return false;
  end if;

  -- Membro sem perfil granular: preservar acesso legado (sem enforcement).
  if v_profile_id is null then
    return true;
  end if;

  select op.module_permissions, op.base_role
    into v_perms, v_base
  from organization_profiles op
  where op.id = v_profile_id;

  -- Perfil com base_role admin: bypass.
  if v_base = 'admin' then
    return true;
  end if;

  -- Perfil sem permissoes definidas: leniente (legado).
  if v_perms is null then
    return true;
  end if;

  -- Formato granular: module -> subareas -> subarea -> action
  v_val := v_perms #>> array[_module, 'subareas', _subarea, _action];
  if v_val is not null then
    return v_val = 'true';
  end if;

  -- Formato legado plano: module -> {view, edit, delete}
  if (v_perms #>> array[_module, 'view']) is not null then
    if _action = 'view' then
      return (v_perms #>> array[_module, 'view']) = 'true';
    elsif _action = 'delete' then
      return coalesce((v_perms #>> array[_module, 'delete']) = 'true', false);
    else
      return coalesce((v_perms #>> array[_module, 'edit']) = 'true', false);
    end if;
  end if;

  -- Perfil granular mas sem esta chave: negar (igual ao can() no frontend).
  return false;
end;
$$;

grant execute on function public.has_module_permission(uuid, text, text, text) to authenticated;

comment on function public.has_module_permission(uuid, text, text, text) is
  'RLS helper: true se o utilizador atual pode executar (module, subarea, action) numa org. Admins fazem bypass.';

-- ── 2. Aplicar politicas RESTRICTIVE de escrita (auto-protegido) ─────────────
do $do$
declare
  cfg jsonb := $json$[
    { "table": "crm_clients",          "ins": ["clients","list","add"],            "upd": ["clients","list","edit"],            "del": ["clients","list","delete"] },
    { "table": "client_communications","ins": ["clients","communications","add"],   "del": ["clients","communications","delete"] },
    { "table": "cpes",                 "ins": ["clients","cpes","add"],             "upd": ["clients","cpes","edit"],            "del": ["clients","cpes","delete"] },
    { "table": "leads",                "ins": ["leads","kanban","add"],             "del": ["leads","kanban","delete"] },
    { "table": "prospects",            "ins": ["prospects","list","add"],           "upd": ["prospects","list","edit"],          "del": ["prospects","list","delete"] },
    { "table": "proposals",            "ins": ["proposals","proposals","create"],   "upd": ["proposals","proposals","edit"],     "del": ["proposals","proposals","delete"] },
    { "table": "sales",                "ins": ["sales","sales","create"],           "upd": ["sales","sales","edit"],             "del": ["sales","sales","delete"] },
    { "table": "expenses",             "ins": ["finance","expenses","add"],         "upd": ["finance","expenses","edit"],        "del": ["finance","expenses","delete"] },
    { "table": "calendar_events",      "ins": ["calendar","events","create"],       "upd": ["calendar","events","edit"],         "del": ["calendar","events","delete"] },
    { "table": "email_templates",      "ins": ["marketing","templates","create"],   "upd": ["marketing","templates","edit"],     "del": ["marketing","templates","delete"] },
    { "table": "email_campaigns",      "ins": ["marketing","campaigns","create"],   "upd": ["marketing","campaigns","edit"],     "del": ["marketing","campaigns","delete"] },
    { "table": "ecommerce_products",   "ins": ["ecommerce","products","create"],    "upd": ["ecommerce","products","edit"],      "del": ["ecommerce","products","delete"] },
    { "table": "discount_codes",       "ins": ["ecommerce","discounts","create"],   "upd": ["ecommerce","discounts","edit"],     "del": ["ecommerce","discounts","delete"] },
    { "table": "rh_absences",          "ins": ["portal_total_link","rh","add"],     "upd": ["portal_total_link","rh","edit"] },
    { "table": "bank_accounts",        "ins": ["finance","bank_accounts","manage"],      "upd": ["finance","bank_accounts","manage"],      "del": ["finance","bank_accounts","manage"] },
    { "table": "expense_categories",   "ins": ["finance","expense_categories","manage"], "upd": ["finance","expense_categories","manage"], "del": ["finance","expense_categories","manage"] },
    { "table": "monthly_commitments",  "ins": ["gestao","commitments","manage"],         "upd": ["gestao","commitments","manage"],         "del": ["gestao","commitments","manage"] }
  ]$json$::jsonb;

  item jsonb;
  tbl text;
  has_org boolean;
  has_rls boolean;
  cmd record;
begin
  for item in select * from jsonb_array_elements(cfg)
  loop
    tbl := item->>'table';

    if to_regclass('public.' || tbl) is null then
      raise notice 'has_module_permission RLS: tabela % inexistente, saltada.', tbl;
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'organization_id'
    ) into has_org;

    if not has_org then
      raise notice 'has_module_permission RLS: % sem organization_id, saltada.', tbl;
      continue;
    end if;

    select c.relrowsecurity into has_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = tbl;

    if not coalesce(has_rls, false) then
      raise notice 'has_module_permission RLS: % tem RLS desativada (politica criada mas inativa ate ativar RLS).', tbl;
    end if;

    -- INSERT
    if item ? 'ins' then
      execute format('drop policy if exists %I on public.%I', 'perm_write_ins_' || tbl, tbl);
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated '
        || 'with check (public.has_module_permission(organization_id, %L, %L, %L))',
        'perm_write_ins_' || tbl, tbl,
        item->'ins'->>0, item->'ins'->>1, item->'ins'->>2
      );
    end if;

    -- UPDATE (USING + WITH CHECK)
    if item ? 'upd' then
      execute format('drop policy if exists %I on public.%I', 'perm_write_upd_' || tbl, tbl);
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated '
        || 'using (public.has_module_permission(organization_id, %L, %L, %L)) '
        || 'with check (public.has_module_permission(organization_id, %L, %L, %L))',
        'perm_write_upd_' || tbl, tbl,
        item->'upd'->>0, item->'upd'->>1, item->'upd'->>2,
        item->'upd'->>0, item->'upd'->>1, item->'upd'->>2
      );
    end if;

    -- DELETE (USING)
    if item ? 'del' then
      execute format('drop policy if exists %I on public.%I', 'perm_write_del_' || tbl, tbl);
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated '
        || 'using (public.has_module_permission(organization_id, %L, %L, %L))',
        'perm_write_del_' || tbl, tbl,
        item->'del'->>0, item->'del'->>1, item->'del'->>2
      );
    end if;

    raise notice 'has_module_permission RLS: politicas de escrita aplicadas em %.', tbl;
  end loop;
end;
$do$;

-- ============================================================================
-- ROLLBACK (correr para remover o enforcement; deixa o resto da RLS intacto)
-- ============================================================================
-- do $do$
-- declare t text;
-- begin
--   foreach t in array array[
--     'crm_clients','client_communications','cpes','leads','prospects','proposals',
--     'sales','expenses','calendar_events','email_templates','email_campaigns',
--     'ecommerce_products','discount_codes','rh_absences',
--     'bank_accounts','expense_categories','monthly_commitments'
--   ] loop
--     if to_regclass('public.'||t) is not null then
--       execute format('drop policy if exists %I on public.%I', 'perm_write_ins_'||t, t);
--       execute format('drop policy if exists %I on public.%I', 'perm_write_upd_'||t, t);
--       execute format('drop policy if exists %I on public.%I', 'perm_write_del_'||t, t);
--     end if;
--   end loop;
-- end $do$;
-- drop function if exists public.has_module_permission(uuid, text, text, text);
