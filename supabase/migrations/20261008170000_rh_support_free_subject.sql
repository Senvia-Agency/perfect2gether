-- Support requests use a free-text title and need no department or configured subject.
CREATE OR REPLACE FUNCTION public.rh_record_save_internal (_org uuid, _kind text, _data jsonb, _id uuid DEFAULT NULL, _user uuid DEFAULT auth.uid (), _parent uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  r rh_records;
  t rh_records;
  area text;
  manager boolean;
  recipient uuid;
BEGIN
  IF jsonb_typeof(_data) <> 'object' OR EXISTS (
    SELECT
      1
    FROM
      jsonb_each(_data) v
    WHERE
      jsonb_typeof(v.value)
      NOT IN ('string', 'number', 'boolean', 'null', 'array')) OR EXISTS (
  SELECT
    1
  FROM
    jsonb_each(_data) v
  CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(v.value) = 'array' THEN
    v.value
  ELSE
    '[]'::jsonb
  END) e
WHERE
  jsonb_typeof(e.value) <> 'string') THEN
RAISE EXCEPTION 'Dados RH inválidos';
  END IF;
  area = CASE WHEN _kind IN ('ticket', 'message', 'department', 'subject') THEN
    'support'
  WHEN _kind IN ('group', 'notice', 'recipient') THEN
    'communication'
  WHEN _kind = 'document' THEN
    'documents'
  ELSE
    'employees'
  END;
  manager = rh_can (_org, area, 'manage');
  IF NOT rh_member (_org) OR NOT rh_member (_org, _user) OR (_kind IN ('employee', 'health') AND NOT rh_active_member (_org, _user)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _id IS NOT NULL THEN
    SELECT
      * INTO r
    FROM
      rh_records
    WHERE
      id = _id
      AND organization_id = _org
      AND kind = _kind
    FOR UPDATE;
    IF NOT FOUND OR r.user_id <> _user OR r.parent_id IS DISTINCT FROM _parent THEN
      RAISE EXCEPTION 'Registo inválido';
    END IF;
  END IF;
  IF _kind IN ('group', 'notice', 'recipient', 'department', 'subject', 'health') AND NOT manager THEN
    RAISE EXCEPTION 'Sem permissão de gestão';
  END IF;
  IF _kind IN ('employee', 'document', 'ticket') AND _user <> auth.uid () AND NOT manager THEN
    RAISE EXCEPTION 'Só pode alterar os seus registos';
  END IF;
  IF _kind = 'employee' THEN
    IF nullif (_data ->> 'birth_date', '') IS NOT NULL THEN PERFORM nullif(_data->>'birth_date','')::date;
    END IF;
    IF nullif (_data ->> 'admission_date', '') IS NOT NULL THEN
      PERFORM
        (_data ->> 'admission_date')::date;
    END IF;
    IF EXISTS (
      SELECT
        1
      FROM
        jsonb_object_keys(_data) k
      WHERE
        k NOT IN ('full_name', 'phone', 'address', 'nationality', 'identity_document', 'emergency_contact', 'birth_date', 'admission_date', 'job_title', 'department')) THEN
    RAISE EXCEPTION 'Campo não autorizado';
  END IF;
  IF NOT manager AND EXISTS (
    SELECT
      1
    FROM
      jsonb_object_keys(_data) k
    WHERE
      k NOT IN ('phone', 'address', 'nationality', 'identity_document', 'emergency_contact')) THEN
    RAISE EXCEPTION 'Dados profissionais exigem gestor';
  END IF;
  IF _id IS NULL AND EXISTS (
    SELECT
      1
    FROM
      rh_records
    WHERE
      organization_id = _org AND user_id = _user AND kind = 'employee') THEN
    RAISE EXCEPTION 'Ficha existente; indique o registo';
  END IF;
  _data = COALESCE(r.data, '{}') || _data;
END IF;
  IF _kind = 'message' THEN
    SELECT
      * INTO t
    FROM
      rh_records
    WHERE
      id = _parent
      AND organization_id = _org
      AND kind = 'ticket';
    IF NOT FOUND OR NOT rh_record_visible (t.organization_id, t.user_id, t.kind, t.data, t.parent_id) OR (_user <> auth.uid ()) THEN
      RAISE EXCEPTION 'Conversa não autorizada';
    END IF;
    IF t.data ->> 'status' = 'closed' THEN
      RAISE EXCEPTION 'Ticket encerrado';
    END IF;
    IF nullif (trim(_data ->> 'body'), '') IS NULL THEN
      RAISE EXCEPTION 'Escreva uma mensagem';
    END IF;
  END IF;
  IF _kind = 'ticket' THEN
    IF nullif (trim(_data ->> 'title'), '') IS NULL OR _data ->> 'priority' NOT IN ('low', 'normal', 'high', 'urgent') OR _data ->> 'status' NOT IN ('open', 'in_progress', 'resolved', 'closed') THEN
      RAISE EXCEPTION 'Ticket inválido';
    END IF;
    IF NOT manager AND (_id IS NULL AND _data ->> 'status' <> 'open' OR _id IS NOT NULL AND _data ->> 'status' <> r.data ->> 'status') THEN
      RAISE EXCEPTION 'Estado exige gestor';
    END IF;
END IF;
  IF _kind = 'document' THEN
    IF _id IS NOT NULL AND _data ->> 'path' IS DISTINCT FROM r.data ->> 'path' THEN
      RAISE EXCEPTION 'O caminho do documento não pode ser alterado';
    END IF;
    PERFORM
      1
    FROM
      rh_storage_cleanup
    WHERE
      organization_id = _org
      AND path = _data ->> 'path'
    FOR UPDATE;
    IF EXISTS (
      SELECT
        1
      FROM
        rh_storage_cleanup
      WHERE
        organization_id = _org
        AND path = _data ->> 'path'
        AND state IN ('processing', 'done')) THEN
    RAISE EXCEPTION 'O carregamento expirou; carregue novamente';
  END IF;
  IF _parent IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      rh_records attached_ticket
    WHERE
      attached_ticket.id = _parent AND attached_ticket.organization_id = _org AND attached_ticket.kind = 'ticket' AND (attached_ticket.user_id = auth.uid () OR rh_can (_org, 'support', 'manage'))) THEN
    RAISE EXCEPTION 'Anexo não autorizado';
  END IF;
  IF _data ->> 'absence_id' IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      rh_absences a
    WHERE
      a.id = (_data ->> 'absence_id')::uuid AND a.organization_id = _org AND a.user_id = _user AND (a.user_id = auth.uid () OR rh_can (_org, 'absences', 'manage'))) THEN
    RAISE EXCEPTION 'Justificação não autorizada';
  END IF;
  IF _data ->> 'path' NOT LIKE _org::text || '/' || _user::text || '/%' OR nullif (_data ->> 'category', '') IS NULL OR nullif(_data->>'name','') IS NULL THEN
    RAISE EXCEPTION 'Documento inválido';
  END IF;
END IF;
  IF _kind IN ('group', 'department', 'subject', 'recipient') AND nullif (trim(_data ->> 'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;
  IF _kind = 'notice' AND (nullif (trim(_data ->> 'title'), '') IS NULL OR nullif(trim(_data->>'body'),'') IS NULL) THEN
    RAISE EXCEPTION 'Título e aviso obrigatórios';
  END IF;
  IF _kind = 'subject' AND NOT EXISTS (
    SELECT
      1
    FROM
      rh_records
    WHERE
      id = (_data ->> 'department_id')::uuid AND organization_id = _org AND kind = 'department') THEN
    RAISE EXCEPTION 'Departamento inválido';
  END IF;
  IF _kind = 'recipient' THEN
    IF COALESCE(_data ->> 'channel', 'in_app')
      NOT IN ('in_app', 'email') OR COALESCE(_data ->> 'event', 'all')
      NOT IN ('all', 'absence', 'birthday', 'health', 'support') THEN
      RAISE EXCEPTION 'Configuração inválida';
    END IF;
    IF EXISTS (
      SELECT
        1
      FROM
        jsonb_array_elements_text(COALESCE(_data -> 'emails', '[]')) email
      WHERE
        NOT rh_valid_email (email)) THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
END IF;
  IF _kind = 'health' THEN
    IF COALESCE((_data ->> 'renewal_months')::integer, 12)
      NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Periodicidade inválida';
    END IF;
    _data = _data || jsonb_build_object('renewal_months', COALESCE((_data ->> 'renewal_months')::integer, 12), 'next_at', ((_data ->> 'appointment_at')::timestamptz + make_interval(months => COALESCE((_data ->> 'renewal_months')::integer, 12))), 'renewal_remind_at', ((_data ->> 'appointment_at')::timestamptz + make_interval(months => COALESCE((_data ->> 'renewal_months')::integer, 12)) - interval '7 days'));
  END IF;
  IF _kind = 'health' AND ((_data ->> 'appointment_at')::timestamptz IS NULL OR (_data ->> 'remind_at')::timestamptz IS NULL) THEN
    RAISE EXCEPTION 'Indique consulta e lembrete';
  END IF;
  IF _kind IN ('notice', 'group', 'recipient') THEN
    FOR recipient IN
    SELECT
      value::text::uuid
    FROM
      jsonb_array_elements_text(COALESCE(_data -> 'recipients', '[]'))
      LOOP
        IF NOT rh_active_member (_org, recipient) THEN
          RAISE EXCEPTION 'Destinatário inválido';
        END IF;
      END LOOP;
  END IF;
INSERT INTO rh_records (id, organization_id, user_id, kind, parent_id, data)
  VALUES (COALESCE(_id, gen_random_uuid ()), _org, _user, _kind, _parent, _data)
ON CONFLICT (id)
  DO UPDATE SET
    data = excluded.data, updated_at = now()
  RETURNING
    * INTO r;
  IF _kind = 'document' THEN
    UPDATE
      rh_storage_cleanup
    SET
      state = 'linked',
      last_error = NULL
    WHERE
      organization_id = _org
      AND path = _data ->> 'path';
  END IF;
  IF _kind = 'recipient' THEN
    DELETE FROM rh_notifications
    WHERE organization_id = _org
      AND state IN ('queued', 'failed', 'processing')
      AND source_record_id = r.id;
  END IF;
  IF _kind = 'health' THEN
    INSERT INTO rh_notifications (organization_id, user_id, event_key, payload, due_at)
      VALUES (_org, _user, 'health:' || r.id, jsonb_build_object('title', 'Saúde no trabalho', 'record_id', r.id),
        (_data ->> 'remind_at')::timestamptz)
    ON CONFLICT (organization_id, user_id, event_key)
      DO UPDATE SET
        due_at = excluded.due_at, payload = excluded.payload, state = 'queued', delivered_at = NULL, attempts = 0, last_error = NULL;
    INSERT INTO rh_notifications (organization_id, user_id, event_key, payload, due_at)
      VALUES (_org, _user, 'health-renewal:' || r.id, jsonb_build_object('title', 'Renovação de saúde no trabalho', 'record_id', r.id),
        (_data ->> 'renewal_remind_at')::timestamptz)
    ON CONFLICT (organization_id, user_id, event_key)
      DO UPDATE SET
        due_at = excluded.due_at, payload = excluded.payload, state = 'queued', delivered_at = NULL, attempts = 0, last_error = NULL;
    DELETE FROM rh_notifications
    WHERE organization_id = _org
      AND channel = 'email'
      AND (event_key LIKE 'health:' || r.id || ':%'
        OR event_key LIKE 'health-renewal:' || r.id || ':%')
      AND state IN ('queued', 'failed', 'processing');
    PERFORM
      rh_fanout (_org, 'health', 'health:' || r.id || ':' || gen_random_uuid ()::text, 'Lembrete de saúde no trabalho', NULL, r.id);
    UPDATE
      rh_notifications
    SET
      due_at = (_data ->> 'remind_at')::timestamptz
    WHERE
      organization_id = _org
      AND channel = 'email'
      AND event_key LIKE 'health:' || r.id || ':%'
      AND state = 'queued';
    PERFORM
      rh_fanout (_org, 'health', 'health-renewal:' || r.id || ':' || gen_random_uuid ()::text, 'Renovação de saúde no trabalho', NULL, r.id);
    UPDATE
      rh_notifications
    SET
      due_at = (_data ->> 'renewal_remind_at')::timestamptz
    WHERE
      organization_id = _org
      AND channel = 'email'
      AND event_key LIKE 'health-renewal:' || r.id || ':%'
      AND state = 'queued';
  ELSIF _kind = 'notice' THEN
    DELETE FROM rh_notifications n
    WHERE n.organization_id = _org
      AND n.event_key = 'notice:' || r.id
      AND (_data ->> 'active' = 'false'
        OR NOT EXISTS (
          SELECT
            1
          FROM
            organization_members m
          WHERE
            m.organization_id = _org
            AND m.user_id = n.user_id
            AND m.is_active
            AND (COALESCE(jsonb_array_length(_data -> 'recipients'), 0) = 0
              OR _data -> 'recipients' ? m.user_id::text)));
    INSERT INTO rh_notifications (organization_id, user_id, event_key, payload)
    SELECT
      _org,
      m.user_id,
      'notice:' || r.id,
      jsonb_build_object('title', _data ->> 'title', 'record_id', r.id)
    FROM
      organization_members m
    WHERE
      m.organization_id = _org
      AND m.is_active
      AND COALESCE(_data ->> 'active', 'true') = 'true'
      AND (COALESCE(jsonb_array_length(_data -> 'recipients'), 0) = 0
        OR _data -> 'recipients' ? m.user_id::text)
    ON CONFLICT (organization_id,
      user_id,
      event_key)
      DO UPDATE SET
        payload = excluded.payload;
  ELSIF _kind = 'ticket' THEN
    PERFORM
      rh_fanout (_org, 'support', 'ticket:' || r.id || ':' || gen_random_uuid ()::text, _data ->> 'title', (_data ->> 'department_id')::uuid);
  ELSIF _kind = 'message' THEN
    INSERT INTO rh_notifications (organization_id, user_id, event_key, payload)
    SELECT
      _org,
      t.user_id,
      'message:' || r.id,
      jsonb_build_object('title', 'Resposta ao suporte RH', 'record_id', _parent)
    WHERE
      t.user_id <> auth.uid ()
    ON CONFLICT
      DO NOTHING;
    PERFORM
      rh_fanout (_org, 'support', 'message:' || r.id, 'Mensagem no suporte RH', (t.data ->> 'department_id')::uuid);
  END IF;
  RETURN to_jsonb (r);
END
$$;

REVOKE ALL ON FUNCTION public.rh_record_save_internal(uuid,text,jsonb,uuid,uuid,uuid) FROM PUBLIC, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
