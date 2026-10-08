ALTER TABLE public.rh_vacation_balances
  ADD COLUMN IF NOT EXISTS company_reserved_days numeric NOT NULL DEFAULT 0;

ALTER TABLE public.rh_vacation_balances
  ADD COLUMN IF NOT EXISTS pending_days numeric NOT NULL DEFAULT 0;

ALTER TABLE public.rh_vacation_balances
  ADD COLUMN IF NOT EXISTS personal_available_days numeric NOT NULL DEFAULT 22;

ALTER TABLE public.rh_vacation_balances
  ADD COLUMN IF NOT EXISTS company_available_days numeric NOT NULL DEFAULT 0;

ALTER TABLE public.rh_absences
  ADD COLUMN IF NOT EXISTS allocation text NOT NULL DEFAULT 'personal';

CREATE TABLE public.rh_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  user_id uuid NOT NULL REFERENCES auth.users (id),
  kind text NOT NULL CHECK (kind IN ('employee', 'document', 'health', 'group', 'notice', 'department', 'subject', 'ticket', 'message', 'recipient')),
  parent_id uuid REFERENCES public.rh_records (id),
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  user_id uuid NOT NULL,
  absence_id uuid REFERENCES public.rh_absences (id),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  user_id uuid NOT NULL,
  recipient_user_id uuid,
  source_record_id uuid REFERENCES public.rh_records (id) ON DELETE SET NULL,
  event_key text NOT NULL,
  payload jsonb NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email')),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  last_error text,
  UNIQUE (organization_id, user_id, event_key)
);

CREATE TABLE public.rh_storage_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  user_id uuid NOT NULL,
  path text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'processing', 'linked', 'done', 'failed')),
  due_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  last_error text
);

ALTER TABLE public.rh_storage_cleanup ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rh_valid_email (_address text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $valid$
  SELECT _address ~* $email$^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$$email$
$valid$;

CREATE INDEX rh_records_scope ON public.rh_records (organization_id, kind, user_id);

CREATE INDEX rh_notifications_due ON public.rh_notifications (state, due_at);

ALTER TABLE public.rh_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rh_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rh_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rh_member (_org uuid, _user uuid DEFAULT auth.uid ())
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    public.p2g_mfa_ok ()
    AND EXISTS (
      SELECT
        1
      FROM
        organizations
      WHERE
        id = _org)
    AND (auth.role () = 'service_role'
      OR public.has_role (auth.uid (), 'super_admin'::app_role)
      OR EXISTS (
        SELECT
          1
        FROM
          organization_members
        WHERE
          organization_id = _org
          AND user_id = auth.uid ()
          AND is_active))
    AND ((auth.role () = 'service_role'
        AND _user IS NULL)
      OR (_user = auth.uid ()
        AND public.has_role (auth.uid (), 'super_admin'::app_role))
      OR EXISTS (
        SELECT
          1
        FROM
          organization_members
        WHERE
          organization_id = _org
          AND user_id = _user
          AND is_active))
$$;

CREATE OR REPLACE FUNCTION public.rh_active_member (_org uuid, _user uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    rh_member (_org)
    AND EXISTS (
      SELECT
        1
      FROM
        organization_members
      WHERE
        organization_id = _org
        AND user_id = _user
        AND is_active)
$$;

CREATE OR REPLACE FUNCTION public.rh_can (_org uuid, _area text, _action text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    public.rh_member (_org)
    AND (public.has_role (auth.uid (), 'super_admin'::app_role)
      OR EXISTS (
        SELECT
          1
        FROM
          organization_members m
        LEFT JOIN organization_profiles p ON p.id = m.profile_id
          AND p.organization_id = m.organization_id
      WHERE
        m.organization_id = _org
        AND m.user_id = auth.uid ()
        AND m.is_active
        AND (public.has_role (auth.uid (), 'admin'::app_role)
          OR p.base_role::text = 'admin'
          OR p.module_permissions #>> ARRAY['rh', 'subareas', _area, _action] = 'true'
          OR (_action = 'view'
            AND (p.module_permissions #>> ARRAY['rh', 'subareas', _area, 'manage'] = 'true'
              OR p.module_permissions #>> ARRAY['rh', 'subareas', _area, 'approve'] = 'true'))
          OR (_area IN ('absences', 'balances', 'calendar')
            AND p.module_permissions #>> ARRAY['portal_total_link', 'subareas', 'rh', CASE WHEN _action = 'view' THEN
              'view'
            ELSE
              'edit'
            END] = 'true'))))
$$;

REVOKE ALL ON FUNCTION public.rh_active_member (uuid, uuid) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.rh_attachment_visible (_org uuid, _user uuid, _data jsonb, _parent uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    rh_member (_org)
    AND (_user = auth.uid ()
      OR rh_can (_org, 'documents', 'manage')
      OR (_data ->> 'absence_id' IS NOT NULL
        AND EXISTS (
          SELECT
            1
          FROM
            rh_absences a
          WHERE
            a.id = (_data ->> 'absence_id')::uuid
            AND a.organization_id = _org
            AND (a.user_id = auth.uid ()
              OR rh_can (_org, 'absences', 'manage')
              OR rh_can (_org, 'absences', 'approve'))))
        OR (_parent IS NOT NULL
          AND EXISTS (
            SELECT
              1
            FROM
              rh_records attached_ticket
            WHERE
              attached_ticket.id = _parent
              AND attached_ticket.organization_id = _org
              AND attached_ticket.kind = 'ticket'
              AND (attached_ticket.user_id = auth.uid ()
                OR rh_can (_org, 'support', 'manage')))))
$$;

REVOKE ALL ON FUNCTION public.rh_attachment_visible (uuid, uuid, jsonb, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_attachment_visible (uuid, uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_record_visible (_org uuid, _user uuid, _kind text, _data jsonb, _parent uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    public.rh_member (_org)
    AND ((_kind IN ('department', 'subject')
        OR (_kind IN ('employee', 'document', 'health', 'ticket')
          AND _user = auth.uid ()))
      OR (_kind = 'document'
        AND rh_attachment_visible (_org, _user, _data, _parent))
      OR (_kind = 'notice'
        AND COALESCE(_data ->> 'active', 'true') = 'true'
        AND (COALESCE(jsonb_array_length(_data -> 'recipients'), 0) = 0
          OR (_data -> 'recipients') ? auth.uid ()::text))
      OR (_kind = 'message'
        AND EXISTS (
          SELECT
            1
          FROM
            rh_records attached_ticket
          WHERE
            attached_ticket.id = _parent
            AND attached_ticket.organization_id = _org
            AND attached_ticket.kind = 'ticket'
            AND (attached_ticket.user_id = auth.uid ()
              OR public.rh_can (_org, 'support', 'manage'))))
        OR public.rh_can (_org, CASE WHEN _kind IN ('ticket', 'message', 'department', 'subject') THEN
            'support'
          WHEN _kind IN ('group', 'notice', 'recipient') THEN
            'communication'
          WHEN _kind = 'document' THEN
            'documents'
          ELSE
            'employees'
          END, 'manage'))
$$;

CREATE POLICY rh_records_read ON public.rh_records
  FOR SELECT TO authenticated
    USING (public.rh_record_visible (organization_id, user_id, kind, data, parent_id));

CREATE POLICY rh_history_read ON public.rh_history
  FOR SELECT TO authenticated
    USING (public.rh_member (organization_id)
      AND (user_id = auth.uid () OR public.rh_can (organization_id, 'absences', 'manage') OR public.rh_can (organization_id, 'absences', 'approve')));

CREATE POLICY rh_notifications_read ON public.rh_notifications
  FOR SELECT TO authenticated
    USING (public.rh_member (organization_id)
      AND ((channel = 'in_app' AND user_id = auth.uid ()) OR (channel = 'email' AND recipient_user_id = auth.uid ()) OR public.rh_can (organization_id, 'communication', 'manage')));

-- Existing permissive policies are narrowed, and direct writes are replaced by RPCs.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
  SELECT
    tablename,
    policyname
  FROM
    pg_policies
  WHERE
    schemaname = 'public'
    AND tablename IN ('rh_absences', 'rh_absence_periods', 'rh_vacation_balances', 'rh_holidays')
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END
$$;

CREATE POLICY rh_absences_read ON public.rh_absences
  FOR SELECT TO authenticated
    USING (public.rh_member (organization_id)
      AND (user_id = auth.uid () OR public.rh_can (organization_id, 'absences', 'manage') OR public.rh_can (organization_id, 'absences', 'approve')));

CREATE POLICY rh_periods_read ON public.rh_absence_periods
  FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT
        1
      FROM
        rh_absences a
      WHERE
        a.id = absence_id));

CREATE POLICY rh_balances_read ON public.rh_vacation_balances
  FOR SELECT TO authenticated
    USING (public.rh_member (organization_id)
      AND (user_id = auth.uid () OR public.rh_can (organization_id, 'balances', 'view') OR public.rh_can (organization_id, 'balances', 'manage')));

CREATE POLICY rh_holidays_read ON public.rh_holidays
  FOR SELECT TO authenticated
    USING (public.rh_member (organization_id));

DROP TRIGGER IF EXISTS trg_rh_update_vacation_balance ON public.rh_absences;

CREATE OR REPLACE FUNCTION public.rh_day_weight (_org uuid, _date date, _type text, _start text, _end text)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  SET search_path = public
  AS $$
  SELECT
    CASE WHEN extract(isodow FROM _date) > 5
      OR EXISTS (
        SELECT
          1
        FROM
          rh_holidays
        WHERE
          organization_id = _org
          AND date = _date) THEN
      0
    WHEN _type IN ('partial', 'partial_day') THEN
      extract(epoch FROM (_end::time - _start::time)) / 28800
    ELSE
      1
    END
$$;

CREATE OR REPLACE FUNCTION public.rh_recount (_org uuid, _user uuid, _enforce boolean DEFAULT TRUE)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  b record;
  used numeric;
  pending numeric;
  personal_spent numeric;
  company_spent numeric;
BEGIN
  INSERT INTO rh_vacation_balances (organization_id, user_id, year)
  SELECT DISTINCT
    _org,
    _user,
    extract(year FROM d)::integer
  FROM
    rh_absences a
    JOIN rh_absence_periods p ON p.absence_id = a.id
    CROSS JOIN LATERAL generate_series(p.start_date, p.end_date, '1 day') d
WHERE
  a.organization_id = _org
    AND a.user_id = _user
    AND a.absence_type = 'vacation'
  ON CONFLICT (organization_id,
    user_id,
    year)
    DO NOTHING;
  FOR b IN
  SELECT
    *
  FROM
    rh_vacation_balances
  WHERE
    organization_id = _org
    AND user_id = _user
  FOR UPDATE LOOP
    SELECT
      COALESCE(sum(rh_day_weight (_org, d::date, p.period_type, p.start_time, p.end_time)) FILTER (WHERE p.status = 'approved'), 0),
      COALESCE(sum(rh_day_weight (_org, d::date, p.period_type, p.start_time, p.end_time)) FILTER (WHERE p.status = 'pending'), 0),
      COALESCE(sum(rh_day_weight (_org, d::date, p.period_type, p.start_time, p.end_time)) FILTER (WHERE p.status IN ('approved', 'pending')
        AND a.allocation = 'personal'), 0),
      COALESCE(sum(rh_day_weight (_org, d::date, p.period_type, p.start_time, p.end_time)) FILTER (WHERE p.status IN ('approved', 'pending')
        AND a.allocation = 'company'), 0) INTO used,
      pending,
      personal_spent,
      company_spent
    FROM
      rh_absences a
      JOIN rh_absence_periods p ON p.absence_id = a.id
      CROSS JOIN LATERAL generate_series(p.start_date, p.end_date, '1 day') d
WHERE
  a.organization_id = _org
  AND a.user_id = _user
  AND a.absence_type = 'vacation'
  AND a.status NOT IN ('rejected', 'cancelled')
  AND extract(year FROM d) = b.year;
    IF _enforce AND used + pending > b.total_days THEN
      RAISE EXCEPTION 'Saldo de férias insuficiente para %', b.year;
    END IF;
    IF _enforce AND EXISTS (
      SELECT
        1
      FROM
        rh_absences a
        JOIN rh_absence_periods p ON p.absence_id = a.id
        CROSS JOIN LATERAL generate_series(p.start_date, p.end_date, '1 day') d
      WHERE
        a.organization_id = _org AND a.user_id = _user AND a.absence_type = 'vacation' AND a.status NOT IN ('rejected', 'cancelled') AND p.status IN ('approved', 'pending') AND extract(year FROM d) = b.year
      GROUP BY
        a.allocation
      HAVING
        sum(rh_day_weight (_org, d::date, p.period_type, p.start_time, p.end_time)) > CASE WHEN a.allocation = 'company' THEN
          b.company_reserved_days
        ELSE
          b.total_days - b.company_reserved_days
        END) THEN
    RAISE EXCEPTION 'Quota de férias insuficiente para %', b.year;
    END IF;
    UPDATE
      rh_vacation_balances
    SET
      used_days = used,
      pending_days = pending,
      personal_available_days = b.total_days - b.company_reserved_days - personal_spent,
      company_available_days = b.company_reserved_days - company_spent,
      updated_at = now()
    WHERE
      id = b.id;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.rh_fanout (_org uuid, _event text, _key text, _title text, _department uuid DEFAULT NULL, _record uuid DEFAULT NULL)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  cfg rh_records;
  target uuid;
  address text;
BEGIN
  FOR cfg IN
  SELECT
    *
  FROM
    rh_records
  WHERE
    organization_id = _org
    AND kind = 'recipient'
    AND COALESCE(data ->> 'active', 'true') = 'true'
    AND COALESCE(data ->> 'event', 'all') IN (_event, 'all')
    AND (nullif (data ->> 'department_id', '') IS NULL
      OR data ->> 'department_id' = _department::text)
      LOOP
        FOR target IN
        SELECT
          value::uuid
        FROM
          jsonb_array_elements_text(COALESCE(cfg.data -> 'recipients', '[]'))
          LOOP
            IF rh_member (_org, target) AND target IS DISTINCT FROM auth.uid () THEN
              SELECT
                email INTO address
              FROM
                profiles
              WHERE
                id = target;
              IF cfg.data ->> 'channel' = 'email' AND (address IS NULL OR NOT rh_valid_email (address)) THEN
                CONTINUE;
              END IF;
              INSERT INTO rh_notifications (organization_id, user_id, recipient_user_id, source_record_id, event_key, payload, channel)
                VALUES (_org, target, target, cfg.id, _key || ':' || cfg.id, jsonb_build_object('title', _title, 'event', _event, 'to', address, 'record_id', _record), COALESCE(cfg.data ->> 'channel', 'in_app'))
              ON CONFLICT
                DO NOTHING;
            END IF;
          END LOOP;
        FOR address IN
        SELECT
          value
        FROM
          jsonb_array_elements_text(
            CASE WHEN cfg.data ->> 'channel' = 'email' THEN
              COALESCE(cfg.data -> 'emails', '[]')
            ELSE
              '[]'::jsonb
            END)
          LOOP
            INSERT INTO rh_notifications (organization_id, user_id, source_record_id, event_key, payload, channel)
              VALUES (_org, cfg.user_id, cfg.id, _key || ':' || cfg.id || ':' || address, jsonb_build_object('title', _title, 'event', _event, 'to', address, 'record_id', _record), 'email')
            ON CONFLICT
              DO NOTHING;
          END LOOP;
      END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.rh_fanout (uuid, text, text, text, uuid, uuid) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.rh_absence_mutate (_org uuid, _action text, _payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  a rh_absences;
  old_data jsonb;
  target uuid;
  aid uuid;
  item jsonb;
  p rh_absence_periods;
  s date;
  e date;
  st text;
  et text;
  typ text;
  days numeric;
  reason text;
  selected_date date;
  result jsonb = '[]';
BEGIN
  IF NOT rh_member (_org) THEN
    RAISE EXCEPTION 'Acesso RH negado';
  END IF;
  PERFORM
    pg_advisory_xact_lock(hashtextextended('rh-org:' || _org::text, 0));
  IF _action = 'batch' THEN
    IF COALESCE(jsonb_array_length(_payload -> 'users'), 0) = 0 THEN
      RAISE EXCEPTION 'Selecione colaboradores';
    END IF;
    IF NOT rh_can (_org, 'absences', 'manage') THEN
      RAISE EXCEPTION 'Sem permissão de gestão';
    END IF;
    FOR item IN
    SELECT
      value
    FROM
      jsonb_array_elements(_payload -> 'users')
      LOOP
        result = result || jsonb_build_array(rh_absence_mutate (_org, 'create', (_payload - 'users') || jsonb_build_object('user_id', item)));
      END LOOP;
    RETURN result;
  END IF;
  IF _action = 'create' THEN
    target = COALESCE((_payload ->> 'user_id')::uuid, auth.uid ());
    aid = gen_random_uuid ();
  ELSE
    SELECT
      * INTO a
    FROM
      rh_absences
    WHERE
      id = (_payload ->> 'id')::uuid
      AND organization_id = _org
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido não encontrado';
    END IF;
    target = a.user_id;
    aid = a.id;
    old_data = to_jsonb (a) || jsonb_build_object('periods', (
        SELECT
          COALESCE(jsonb_agg(hp), '[]')
        FROM rh_absence_periods hp
        WHERE
          hp.absence_id = a.id));
  END IF;
  IF NOT rh_active_member (_org, target) THEN
    RAISE EXCEPTION 'Colaborador inativo';
  END IF;
  PERFORM
    pg_advisory_xact_lock(hashtextextended('rh-org:' || _org::text, 0));
  PERFORM
    pg_advisory_xact_lock(hashtextextended(_org::text || target::text, 0));
  IF _action IN ('approve', 'partial', 'reject', 'withdraw') THEN
    IF NOT rh_can (_org, 'absences', 'approve') THEN
      RAISE EXCEPTION 'Sem permissão de aprovação';
    END IF;
  ELSE
    IF target <> auth.uid () AND NOT rh_can (_org, 'absences', 'manage') THEN
      RAISE EXCEPTION 'Sem permissão de gestão';
    END IF;
  END IF;
  reason = nullif (trim(_payload ->> 'reason'), '');
  IF _action IN ('reject', 'withdraw') AND reason IS NULL THEN
    RAISE EXCEPTION 'Indique o motivo';
  END IF;
  IF _action IN ('create', 'edit') THEN
    IF _action = 'edit' AND a.status IN ('cancelled', 'rejected') THEN
      RAISE EXCEPTION 'Pedido encerrado';
    END IF;
    IF _payload ->> 'absence_type' NOT IN ('vacation', 'sick_leave', 'appointment', 'personal_leave', 'maternity', 'paternity', 'training_online', 'training', 'other') THEN
      RAISE EXCEPTION 'Tipo inválido';
    END IF;
    IF COALESCE(jsonb_array_length(_payload -> 'periods'), 0) = 0 THEN
      RAISE EXCEPTION 'Indique pelo menos um período';
    END IF;
    IF _action = 'create' THEN
      INSERT INTO rh_absences (id, organization_id, user_id, absence_type, start_date, end_date, notes, allocation)
        VALUES (aid, _org, target, _payload ->> 'absence_type', CURRENT_DATE, CURRENT_DATE, _payload ->> 'notes', COALESCE(_payload ->> 'allocation', 'personal'));
    ELSE
      DELETE FROM rh_absence_periods
      WHERE absence_id = aid;
      UPDATE
        rh_absences
      SET
        absence_type = _payload ->> 'absence_type',
        status = 'pending',
        approved_by = NULL,
        approved_at = NULL,
        notes = _payload ->> 'notes',
        allocation = COALESCE(_payload ->> 'allocation', 'personal')
      WHERE
        id = aid;
    END IF;
    IF COALESCE(_payload ->> 'allocation', 'personal')
      NOT IN ('personal', 'company') OR (_payload ->> 'allocation' = 'company' AND NOT rh_can (_org, 'absences', 'manage')) THEN
      RAISE EXCEPTION 'Reserva da empresa não autorizada';
    END IF;
    FOR item IN
    SELECT
      value
    FROM
      jsonb_array_elements(_payload -> 'periods')
      LOOP
        s = (item ->> 'start_date')::date;
        e = (item ->> 'end_date')::date;
        typ = CASE WHEN item ->> 'period_type' = 'partial_day' THEN
          'partial'
        ELSE
          COALESCE(item ->> 'period_type', 'full_day')
        END;
        st = item ->> 'start_time';
        et = item ->> 'end_time';
        IF s IS NULL OR e IS NULL OR e < s OR e - s > 730 OR typ NOT IN ('full_day', 'partial') THEN
          RAISE EXCEPTION 'Período inválido';
        END IF;
        IF typ = 'partial' AND (s <> e OR st IS NULL OR et IS NULL OR et::time <= st::time OR extract(epoch FROM (et::time - st::time)) > 28800) THEN
          RAISE EXCEPTION 'Horário parcial inválido (máximo 8h)';
        END IF;
        IF _payload ->> 'absence_type' = 'vacation' AND target = auth.uid () AND NOT rh_can (_org, 'absences', 'manage') AND ((s::timestamp + CASE WHEN typ = 'partial' THEN
            st::time - '00:00'::time
          ELSE
            interval '0'
          END) AT TIME ZONE 'Europe/Lisbon') < now() + interval '48 hours' THEN
      RAISE EXCEPTION 'Férias exigem antecedência de 48 horas';
        END IF;
        IF EXISTS (
          SELECT
            1
          FROM
            rh_absences x
            JOIN rh_absence_periods q ON q.absence_id = x.id
          WHERE
            x.organization_id = _org
            AND x.user_id = target
            AND x.status NOT IN ('cancelled', 'rejected')
            AND q.status NOT IN ('cancelled', 'rejected')
            AND q.start_date <= e
            AND q.end_date >= s
            AND (typ = 'full_day'
              OR q.period_type = 'full_day'
              OR q.start_time::time < et::time
              AND q.end_time::time > st::time)) THEN
        RAISE EXCEPTION 'Conflito com outro período';
      END IF;
    SELECT
      COALESCE(sum(rh_day_weight (_org, d::date, typ, st, et)), 0) INTO days
    FROM
      generate_series(s, e, '1 day') d;
    IF days <= 0 THEN
      RAISE EXCEPTION 'O período não contém dias úteis';
    END IF;
    INSERT INTO rh_absence_periods (absence_id, start_date, end_date, business_days, period_type, start_time, end_time)
      VALUES (aid, s, e, days, typ, st, et);
  END LOOP;
  UPDATE
    rh_absences
  SET
    start_date = (
      SELECT
        min(start_date)
      FROM
        rh_absence_periods
      WHERE
        absence_id = aid), end_date = (
      SELECT
        max(end_date)
      FROM
        rh_absence_periods
      WHERE
        absence_id = aid), updated_at = now()
  WHERE
    id = aid;
ELSIF _action = 'partial' THEN
  IF a.status NOT IN ('pending', 'partially_approved') OR COALESCE(jsonb_array_length(_payload -> 'approved_dates'), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione dias para aprovar';
  END IF;
  FOR selected_date IN
  SELECT
    value::date
  FROM
    jsonb_array_elements_text(_payload -> 'approved_dates')
    LOOP
      IF NOT EXISTS (
        SELECT
          1
        FROM
          rh_absence_periods
        WHERE
          absence_id = aid
          AND selected_date BETWEEN start_date AND end_date
          AND rh_day_weight (_org, selected_date, period_type, start_time, end_time) > 0) THEN
      RAISE EXCEPTION 'Dia fora do pedido';
    END IF;
END LOOP;
  FOR p IN
  SELECT
    *
  FROM
    rh_absence_periods
  WHERE
    absence_id = aid LOOP
      DELETE FROM rh_absence_periods
      WHERE id = p.id;
      FOR selected_date IN
      SELECT
        d::date
      FROM
        generate_series(p.start_date, p.end_date, '1 day') d LOOP
        days = rh_day_weight (_org, selected_date, p.period_type, p.start_time, p.end_time);
        IF days > 0 THEN
          INSERT INTO rh_absence_periods (absence_id, start_date, end_date, business_days, period_type, start_time, end_time, status)
            VALUES (aid, selected_date, selected_date, days, p.period_type, p.start_time, p.end_time, CASE WHEN (_payload -> 'approved_dates') ? selected_date::text THEN
                'approved'
              ELSE
                'rejected'
              END);
        END IF;
      END LOOP;
    END LOOP;
  UPDATE
    rh_absences
  SET
    status = CASE WHEN EXISTS (
      SELECT
        1
      FROM
        rh_absence_periods
      WHERE
        absence_id = aid
        AND status = 'rejected') THEN
      'partially_approved'
    ELSE
      'approved'
    END,
    approved_by = auth.uid (),
    approved_at = now(),
    rejection_reason = reason,
    updated_at = now()
  WHERE
    id = aid;
ELSIF _action IN ('approve', 'reject', 'withdraw', 'cancel') THEN
  IF a.status = 'cancelled' THEN
    RAISE EXCEPTION 'Pedido já cancelado';
  END IF;
  IF _action = 'approve' AND a.status NOT IN ('pending', 'partially_approved') THEN
    RAISE EXCEPTION 'Só pedidos pendentes podem ser aprovados';
  END IF;
  IF _action = 'withdraw' AND a.status NOT IN ('approved', 'partially_approved') THEN
    RAISE EXCEPTION 'Sem aprovação para retirar';
  END IF;
  UPDATE
    rh_absence_periods
  SET
    status = CASE _action
    WHEN 'approve' THEN
      'approved'
    WHEN 'reject' THEN
      'rejected'
    WHEN 'cancel' THEN
      'cancelled'
    ELSE
      'pending'
    END
  WHERE
    absence_id = aid;
  UPDATE
    rh_absences
  SET
    status = CASE _action
    WHEN 'approve' THEN
      'approved'
    WHEN 'reject' THEN
      'rejected'
    WHEN 'cancel' THEN
      'cancelled'
    ELSE
      'pending'
    END,
    approved_by = CASE WHEN _action IN ('approve', 'reject') THEN
      auth.uid ()
    ELSE
      NULL
    END,
    approved_at = CASE WHEN _action IN ('approve', 'reject') THEN
      now()
    ELSE
      NULL
    END,
    rejection_reason = reason,
    updated_at = now()
  WHERE
    id = aid;
ELSE
  RAISE EXCEPTION 'Ação inválida';
END IF;
  PERFORM
    rh_recount (_org, target, _action NOT IN ('cancel', 'reject'));
  SELECT
    * INTO a
  FROM
    rh_absences
  WHERE
    id = aid;
  INSERT INTO rh_history (organization_id, user_id, absence_id, actor_id, action, reason, before_data, after_data)
    VALUES (_org, target, aid, auth.uid (), _action, reason, old_data, to_jsonb (a) || jsonb_build_object('periods', (
          SELECT
            COALESCE(jsonb_agg(hp), '[]')
          FROM rh_absence_periods hp
          WHERE
            hp.absence_id = a.id)));
  INSERT INTO rh_notifications (organization_id, user_id, event_key, payload)
    VALUES (_org, target, aid::text || ':' || gen_random_uuid ()::text, jsonb_build_object('title', CASE _action
        WHEN 'create' THEN
          'Novo pedido de ausência'
        WHEN 'edit' THEN
          'Pedido de ausência remarcado'
        WHEN 'approve' THEN
          'Pedido de ausência aprovado'
        WHEN 'partial' THEN
          'Pedido de ausência aprovado parcialmente'
        WHEN 'reject' THEN
          'Pedido de ausência rejeitado'
        WHEN 'withdraw' THEN
          'Aprovação de ausência retirada'
        ELSE
          'Pedido de ausência cancelado'
        END, 'absence_id', aid));
  PERFORM
    rh_fanout (_org, 'absence', aid::text || ':' || gen_random_uuid ()::text, CASE _action
    WHEN 'create' THEN
      'Novo pedido de ausência'
    WHEN 'edit' THEN
      'Pedido de ausência remarcado'
    WHEN 'approve' THEN
      'Pedido de ausência aprovado'
    WHEN 'partial' THEN
      'Pedido de ausência aprovado parcialmente'
    WHEN 'reject' THEN
      'Pedido de ausência rejeitado'
    WHEN 'withdraw' THEN
      'Aprovação de ausência retirada'
    ELSE
      'Pedido de ausência cancelado'
    END);
  RETURN to_jsonb (a);
END
$$;

CREATE OR REPLACE FUNCTION public.rh_balance_set (_org uuid, _user uuid, _year integer, _total numeric, _reserved numeric DEFAULT NULL)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  reserved numeric;
BEGIN
  IF NOT rh_can (_org, 'balances', 'manage') OR NOT rh_active_member (_org, _user) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  PERFORM
    pg_advisory_xact_lock(hashtextextended(_org::text || _user::text, 0));
  SELECT
    COALESCE(_reserved, (
        SELECT
          company_reserved_days
        FROM rh_vacation_balances
        WHERE
          organization_id = _org
          AND user_id = _user
          AND year = _year), 0) INTO reserved;
  IF _total IS NULL OR _total < 0 OR reserved < 0 OR reserved > _total OR _year < 2000 OR _year > 2200 THEN
    RAISE EXCEPTION 'Saldo inválido';
  END IF;
  PERFORM
    pg_advisory_xact_lock(hashtextextended(_org::text || _user::text, 0));
  INSERT INTO rh_vacation_balances (organization_id, user_id, year, total_days, company_reserved_days)
    VALUES (_org, _user, _year, _total, reserved)
  ON CONFLICT (organization_id, user_id, year)
    DO UPDATE SET
      total_days = _total, company_reserved_days = reserved;
  PERFORM
    rh_recount (_org, _user);
END
$$;

CREATE OR REPLACE FUNCTION public.rh_record_save (_org uuid, _kind text, _data jsonb, _id uuid DEFAULT NULL, _user uuid DEFAULT auth.uid (), _parent uuid DEFAULT NULL)
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
    IF NOT EXISTS (
      SELECT
        1
      FROM
        rh_records
      WHERE
        id = (_data ->> 'department_id')::uuid
        AND organization_id = _org
        AND kind = 'department') THEN
    RAISE EXCEPTION 'Departamento inválido';
  END IF;
  IF _data ->> 'subject_id' IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      rh_records
    WHERE
      id = (_data ->> 'subject_id')::uuid AND organization_id = _org AND kind = 'subject' AND data ->> 'department_id' = _data ->> 'department_id') THEN
    RAISE EXCEPTION 'Assunto inválido';
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

CREATE OR REPLACE FUNCTION public.rh_directory (_org uuid)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'full_name', p.full_name, 'email', CASE WHEN m.user_id = auth.uid ()
        OR rh_can (_org, 'employees', 'manage') THEN
            p.email
          ELSE
            NULL
          END)), '[]')
  FROM
    organization_members m
    JOIN profiles p ON p.id = m.user_id
  WHERE
    m.organization_id = _org
    AND m.is_active
    AND rh_member (_org)
    AND (m.user_id = auth.uid ()
      OR rh_can (_org, 'employees', 'manage')
      OR rh_can (_org, 'absences', 'manage')
      OR rh_can (_org, 'absences', 'approve')
      OR rh_can (_org, 'balances', 'manage')
      OR rh_can (_org, 'communication', 'manage')
      OR rh_can (_org, 'calendar', 'view')
      OR rh_can (_org, 'absences', 'view'))
$$;

CREATE OR REPLACE FUNCTION public.rh_holiday_set (_org uuid, _date date, _name text, _id uuid DEFAULT NULL, _delete boolean DEFAULT FALSE)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  u uuid;
BEGIN
  IF NOT rh_can (_org, 'calendar', 'manage') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  PERFORM
    pg_advisory_xact_lock(hashtextextended('rh-org:' || _org::text, 0));
  IF _id IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      rh_holidays
    WHERE
      id = _id AND organization_id = _org) THEN
    RAISE EXCEPTION 'Feriado inválido';
  END IF;
  IF _delete THEN
    DELETE FROM rh_holidays
    WHERE id = _id
      AND organization_id = _org;
  ELSE
    IF _date IS NULL OR nullif (trim(_name), '') IS NULL THEN
      RAISE EXCEPTION 'Feriado inválido';
    END IF;
    INSERT INTO rh_holidays (id, organization_id, date, name, year)
      VALUES (COALESCE(_id, gen_random_uuid ()), _org, _date, _name, extract(year FROM _date))
    ON CONFLICT (id)
      DO UPDATE SET
        date = excluded.date, name = excluded.name, year = excluded.year;
  END IF;
  FOR u IN SELECT DISTINCT
    user_id
  FROM
    rh_absences
  WHERE
    organization_id = _org LOOP
      PERFORM
        pg_advisory_xact_lock(hashtextextended(_org::text || u::text, 0));
      PERFORM
        rh_recount (_org, u);
    END LOOP;
  UPDATE
    rh_absence_periods p
  SET
    business_days = (
      SELECT
        COALESCE(sum(rh_day_weight (_org, d::date, p.period_type, p.start_time, p.end_time)), 0)
      FROM
        generate_series(p.start_date, p.end_date, '1 day') d)
  FROM
    rh_absences a
  WHERE
    a.id = p.absence_id
    AND a.organization_id = _org;
  FOR u IN SELECT DISTINCT
    user_id
  FROM
    rh_absences
  WHERE
    organization_id = _org LOOP
      PERFORM
        rh_recount (_org, u);
    END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.rh_directory (uuid), public.rh_holiday_set (uuid, date, text, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_directory (uuid), public.rh_holiday_set (uuid, date, text, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_calendar (_org uuid)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'user_id', a.user_id, 'absence_type', CASE WHEN a.absence_type = 'vacation' THEN
            'vacation'
          ELSE
            'other'
          END, 'status', a.status, 'allocation', a.allocation, 'notes', NULL, 'periods', (
            SELECT
              COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'start_date', p.start_date, 'end_date', p.end_date, 'period_type', p.period_type, 'start_time', p.start_time, 'end_time', p.end_time, 'business_days', p.business_days, 'status', p.status)), '[]')
            FROM rh_absence_periods p
            WHERE
              p.absence_id = a.id))), '[]')
  FROM
    rh_absences a
  WHERE
    a.organization_id = _org
    AND rh_member (_org)
    AND (a.user_id = auth.uid ()
      OR rh_can (_org, 'calendar', 'view')
      OR rh_can (_org, 'absences', 'view'))
$$;

REVOKE ALL ON FUNCTION public.rh_calendar (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_calendar (uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_actor_name (_org uuid, _actor uuid)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    COALESCE((
      SELECT
        full_name
      FROM profiles
      WHERE
        id = _actor), 'Utilizador indisponível')
  WHERE
    rh_member (_org)
    AND EXISTS (
      SELECT
        1
      FROM
        rh_history h
      WHERE
        h.organization_id = _org
        AND h.actor_id = _actor
        AND (h.user_id = auth.uid ()
          OR rh_can (_org, 'absences', 'manage')
          OR rh_can (_org, 'absences', 'approve')))
$$;

REVOKE ALL ON FUNCTION public.rh_actor_name (uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_actor_name (uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_snapshot (_org uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
BEGIN
  IF NOT rh_member (_org) THEN
    RAISE EXCEPTION 'Acesso RH negado';
  END IF;
  RETURN jsonb_build_object('calendar', rh_calendar (_org), 'members', rh_directory (_org), 'permissions', (
      SELECT
        jsonb_object_agg(area || '.' || action, rh_can (_org, area, action))
      FROM unnest(ARRAY['absences', 'balances', 'calendar', 'employees', 'documents', 'support', 'communication'])
      area
    CROSS JOIN unnest(ARRAY['view', 'manage', 'approve']) action), 'absences', COALESCE((
    SELECT
      jsonb_agg(to_jsonb (a) || jsonb_build_object('periods', (
          SELECT
            COALESCE(jsonb_agg(p), '[]')
          FROM rh_absence_periods p
        WHERE
          p.absence_id = a.id)))
    FROM rh_absences a
  WHERE
    organization_id = _org), '[]'), 'balances', COALESCE((
  SELECT
    jsonb_agg(b)
  FROM rh_vacation_balances b
WHERE
  organization_id = _org), '[]'), 'records', COALESCE((
  SELECT
    jsonb_agg(r ORDER BY r.created_at)
  FROM rh_records r
WHERE
  organization_id = _org), '[]'), 'history', COALESCE((
  SELECT
    jsonb_agg(to_jsonb (h) || jsonb_build_object('actor_name', rh_actor_name (_org, h.actor_id))
    ORDER BY h.created_at DESC)
  FROM rh_history h
WHERE
  organization_id = _org), '[]'), 'holidays', COALESCE((
  SELECT
    jsonb_agg(h)
  FROM rh_holidays h
WHERE
  organization_id = _org), '[]'), 'notifications', COALESCE((
  SELECT
    jsonb_agg(n ORDER BY due_at DESC)
  FROM rh_notifications n
WHERE
  organization_id = _org), '[]'));
END
$$;

-- Queue worker returns durable in-app notifications; it never sends email.
CREATE OR REPLACE FUNCTION public.rh_notification_tick (_org uuid, _limit integer DEFAULT 100)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  count_done integer;
  birthday rh_records;
BEGIN
  IF NOT rh_can (_org, 'communication', 'manage') AND auth.role () <> 'service_role' THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO rh_notifications (organization_id, user_id, event_key, payload)
  SELECT
    _org,
    r.user_id,
    'birthday:' || r.id || ':' || extract(year FROM CURRENT_DATE),
    jsonb_build_object('title', 'Feliz aniversário!')
  FROM
    rh_records r
  WHERE
    r.organization_id = _org
    AND r.kind = 'employee'
    AND rh_member (_org, r.user_id)
    AND to_char(nullif (r.data ->> 'birth_date', '')::date, 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
  ON CONFLICT
    DO NOTHING;
  FOR birthday IN
  SELECT
    *
  FROM
    rh_records r
  WHERE
    r.organization_id = _org
    AND r.kind = 'employee'
    AND rh_member (_org, r.user_id)
    AND to_char(nullif (r.data ->> 'birth_date', '')::date, 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
    LOOP
      PERFORM
        rh_fanout (_org, 'birthday', 'birthday:' || birthday.id || ':' || extract(year FROM CURRENT_DATE), 'Aniversário de colaborador');
    END LOOP;
  WITH due AS (
    SELECT
      id
    FROM
      rh_notifications
    WHERE
      organization_id = _org
      AND state = 'queued'
      AND channel = 'in_app'
      AND due_at <= now()
    ORDER BY
      due_at
    LIMIT LEAST (GREATEST (_limit, 1), 1000)
    FOR UPDATE
      SKIP LOCKED)
  UPDATE
    rh_notifications n
  SET
    state = 'delivered',
    delivered_at = now(),
    attempts = attempts + 1
  FROM
    due
  WHERE
    n.id = due.id;
  GET DIAGNOSTICS count_done = ROW_COUNT;
  RETURN count_done;
END
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('rh-private', 'rh-private', FALSE, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id)
  DO NOTHING;

CREATE POLICY rh_private_read ON storage.objects
  FOR SELECT TO authenticated
    USING (bucket_id = 'rh-private'
      AND EXISTS (
        SELECT
          1
        FROM
          rh_records r
        WHERE
          r.kind = 'document' AND r.data ->> 'path' = name AND rh_attachment_visible (r.organization_id, r.user_id, r.data, r.parent_id)));

CREATE POLICY rh_private_write ON storage.objects
  FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT
        1
      FROM
        public.rh_storage_cleanup c
      WHERE
        c.path = name AND c.organization_id = (storage.foldername (name))[1]::uuid AND c.user_id = (storage.foldername (name))[2]::uuid AND c.state = 'queued')
        AND bucket_id = 'rh-private'
        AND rh_member ((storage.foldername (name))[1]::uuid)
        AND rh_member ((storage.foldername (name))[1]::uuid, (storage.foldername (name))[2]::uuid)
        AND ((storage.foldername (name))[2] = auth.uid ()::text OR rh_can ((storage.foldername (name))[1]::uuid, 'documents', 'manage')));

REVOKE ALL ON FUNCTION public.rh_recount (uuid, uuid, boolean) FROM PUBLIC, authenticated;

REVOKE ALL ON FUNCTION public.rh_absence_mutate (uuid, text, jsonb), public.rh_balance_set (uuid, uuid, integer, numeric, numeric), public.rh_record_save (uuid, text, jsonb, uuid, uuid, uuid), public.rh_snapshot (uuid), public.rh_notification_tick (uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_absence_mutate (uuid, text, jsonb), public.rh_balance_set (uuid, uuid, integer, numeric, numeric), public.rh_record_save (uuid, text, jsonb, uuid, uuid, uuid), public.rh_snapshot (uuid), public.rh_notification_tick (uuid, integer) TO authenticated;

GRANT SELECT ON public.rh_records, public.rh_history, public.rh_notifications TO authenticated;

DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN
  SELECT
    organization_id,
    user_id
  FROM
    rh_vacation_balances
  UNION
  SELECT
    organization_id,
    user_id
  FROM
    rh_absences
  WHERE
    absence_type = 'vacation' LOOP
      PERFORM
        public.rh_recount (pair.organization_id, pair.user_id, FALSE);
    END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.rh_member (uuid, uuid), public.rh_can (uuid, text, text), public.rh_record_visible (uuid, uuid, text, jsonb, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_member (uuid, uuid), public.rh_can (uuid, text, text), public.rh_record_visible (uuid, uuid, text, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_record_remove (_org uuid, _id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  r rh_records;
  area text;
BEGIN
  SELECT
    * INTO r
  FROM
    rh_records
  WHERE
    id = _id
    AND organization_id = _org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registo inválido';
  END IF;
  area = CASE WHEN r.kind IN ('subject', 'department') THEN
    'support'
  WHEN r.kind IN ('group', 'notice', 'recipient') THEN
    'communication'
  WHEN r.kind = 'document' THEN
    'documents'
  ELSE
    'employees'
  END;
  IF NOT rh_can (_org, area, 'manage') AND NOT (r.kind = 'document' AND r.user_id = auth.uid () AND rh_member (_org)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF r.kind NOT IN ('group', 'notice', 'recipient', 'subject', 'department', 'document', 'health') THEN
    RAISE EXCEPTION 'Não pode eliminar este registo';
  END IF;
  IF r.kind = 'department' AND EXISTS (
    SELECT
      1
    FROM
      rh_records
    WHERE
      organization_id = _org AND kind IN ('ticket', 'subject') AND data ->> 'department_id' = _id::text) OR r.kind = 'subject' AND EXISTS (
  SELECT
    1
  FROM
    rh_records
  WHERE
    organization_id = _org AND kind = 'ticket' AND data ->> 'subject_id' = _id::text) THEN
    RAISE EXCEPTION 'Configuração em uso';
  END IF;
  DELETE FROM rh_notifications
  WHERE organization_id = _org
    AND (payload ->> 'record_id' = _id::text
      OR event_key = 'health:' || _id
      OR event_key = 'notice:' || _id);
  DELETE FROM rh_notifications
  WHERE organization_id = _org
    AND source_record_id = _id
    AND state IN ('queued', 'failed', 'processing');
  IF r.kind = 'document' THEN
    INSERT INTO rh_storage_cleanup (organization_id, user_id, path, due_at)
      VALUES (_org, r.user_id, r.data ->> 'path', now())
    ON CONFLICT (path)
      DO UPDATE SET
        state = 'queued', due_at = now(), attempts = 0, last_error = NULL;
  END IF;
  DELETE FROM rh_records
  WHERE id = _id;
END
$$;

REVOKE ALL ON FUNCTION public.rh_record_remove (uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_record_remove (uuid, uuid) TO authenticated;

ALTER TABLE public.rh_notifications
  DROP CONSTRAINT rh_notifications_state_check;

ALTER TABLE public.rh_notifications
  ADD CONSTRAINT rh_notifications_state_check CHECK (state IN ('queued', 'processing', 'delivered', 'failed', 'uncertain'));

ALTER TABLE public.rh_notifications
  ADD COLUMN claimed_at timestamptz;

ALTER TABLE public.rh_notifications
  ADD COLUMN delivery_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.rh_email_claim (_org uuid, _dry_run boolean DEFAULT TRUE)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT rh_can (_org, 'communication', 'manage') AND auth.role () <> 'service_role' THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT _dry_run THEN
    UPDATE
      rh_notifications
    SET
      state = 'failed',
      attempts = 5,
      last_error = 'Destinatário interno desativado'
    WHERE
      organization_id = _org
      AND channel = 'email'
      AND recipient_user_id IS NOT NULL
      AND state IN ('queued', 'failed', 'processing')
      AND delivery_started_at IS NULL
      AND NOT EXISTS (
        SELECT
          1
        FROM
          organization_members m
        WHERE
          m.organization_id = _org
          AND m.user_id = recipient_user_id
          AND m.is_active);
  END IF;
  IF NOT _dry_run THEN
    UPDATE
      rh_notifications
    SET
      state = 'uncertain',
      last_error = 'Entrega iniciada sem confirmação; confirmar no fornecedor',
      claimed_at = NULL
    WHERE
      organization_id = _org
      AND state = 'processing'
      AND delivery_started_at IS NOT NULL
      AND (claimed_at < now() - interval '10 minutes' OR (recipient_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = _org AND m.user_id = recipient_user_id AND m.is_active)));
  END IF;
  IF _dry_run THEN
    SELECT
      COALESCE(jsonb_agg(n), '[]') INTO result
    FROM (
      SELECT
        *
      FROM
        rh_notifications
      WHERE
        organization_id = _org
        AND channel = 'email'
        AND (recipient_user_id IS NULL
          OR EXISTS (
            SELECT
              1
            FROM
              organization_members m
            WHERE
              m.organization_id = _org
              AND m.user_id = recipient_user_id
              AND m.is_active))
          AND state IN ('queued', 'failed')
          AND due_at <= now()
          AND attempts < 5
        ORDER BY
          due_at
        LIMIT 100) n;
    RETURN result;
  END IF;
  WITH due AS (
    SELECT
      id
    FROM
      rh_notifications
    WHERE
      organization_id = _org
      AND channel = 'email'
      AND (recipient_user_id IS NULL
        OR EXISTS (
          SELECT
            1
          FROM
            organization_members m
          WHERE
            m.organization_id = _org
            AND m.user_id = recipient_user_id
            AND m.is_active))
        AND attempts < 5
        AND ((state IN ('queued', 'failed')
            AND due_at <= now())
          OR (state = 'processing'
            AND delivery_started_at IS NULL
            AND claimed_at < now() - interval '10 minutes'))
      ORDER BY
        due_at
      LIMIT 100
      FOR UPDATE
        SKIP LOCKED
),
claimed AS (
  UPDATE
    rh_notifications n
  SET
    state = 'processing',
    claimed_at = now(),
    attempts = attempts + 1
  FROM
    due
  WHERE
    n.id = due.id
  RETURNING
    n.*
)
SELECT
  COALESCE(jsonb_agg(claimed), '[]') INTO result
FROM
  claimed;
  RETURN result;
END
$$;

REVOKE ALL ON FUNCTION public.rh_email_claim (uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_email_claim (uuid, boolean) TO authenticated;

UPDATE
  rh_absence_periods period
SET
  business_days = (
    SELECT
      COALESCE(sum(rh_day_weight (absence.organization_id, d::date, period.period_type, period.start_time, period.end_time)), 0)
    FROM
      generate_series(period.start_date, period.end_date, '1 day') d)
FROM
  rh_absences absence
WHERE
  absence.id = period.absence_id;

GRANT EXECUTE ON FUNCTION public.rh_notification_tick (uuid, integer), public.rh_email_claim (uuid, boolean), public.rh_member (uuid, uuid) TO service_role;

GRANT SELECT, UPDATE ON public.rh_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.rh_storage_cleanup_request (_org uuid, _path text, _immediate boolean DEFAULT FALSE)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  result uuid;
  target uuid;
BEGIN
  IF NOT rh_member (_org) OR _path NOT LIKE _org::text || '/%' OR array_length(string_to_array(_path, '/'), 1) < 3 THEN
    RAISE EXCEPTION 'Caminho inválido';
  END IF;
  target = split_part(_path, '/', 2)::uuid;
  IF target <> auth.uid () AND NOT rh_can (_org, 'documents', 'manage') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  PERFORM
    1
  FROM
    rh_storage_cleanup
  WHERE
    path = _path
  FOR UPDATE;
  IF EXISTS (
    SELECT
      1
    FROM
      rh_storage_cleanup
    WHERE
      path = _path
      AND (state IN ('processing', 'done') OR attempts >= 5)) THEN
  RAISE EXCEPTION 'O carregamento expirou; carregue novamente';
END IF;
  IF EXISTS (
    SELECT
      1
    FROM
      rh_records
    WHERE
      organization_id = _org
      AND kind = 'document'
      AND data ->> 'path' = _path) THEN
  RAISE EXCEPTION 'Documento em uso';
END IF;
INSERT INTO rh_storage_cleanup (organization_id, user_id, path, due_at)
  VALUES (_org, target, _path, CASE WHEN _immediate THEN
      now()
    ELSE
      now() + interval '1 hour'
    END)
ON CONFLICT (path)
  DO UPDATE SET
    due_at = excluded.due_at, state = 'queued'
  RETURNING
    id INTO result;
  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.rh_storage_cleanup_claim (_org uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.role () <> 'service_role' THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  WITH due AS (
    SELECT
      id
    FROM
      rh_storage_cleanup c
    WHERE
      c.organization_id = _org
      AND (c.state IN ('queued', 'failed')
        OR c.state = 'processing'
        AND c.claimed_at < now() - interval '10 minutes')
      AND c.due_at <= now()
      AND c.attempts < 5
      AND NOT EXISTS (
        SELECT
          1
        FROM
          rh_records r
        WHERE
          r.organization_id = _org
          AND r.kind = 'document'
          AND r.data ->> 'path' = c.path)
      LIMIT 100
      FOR UPDATE
        SKIP LOCKED
),
claimed AS (
  UPDATE
    rh_storage_cleanup c
  SET
    state = 'processing',
    claimed_at = now(),
    attempts = attempts + 1
  FROM
    due
  WHERE
    c.id = due.id
  RETURNING
    c.*
)
SELECT
  COALESCE(jsonb_agg(claimed), '[]') INTO result
FROM
  claimed;
  RETURN result;
END
$$;

REVOKE ALL ON FUNCTION public.rh_storage_cleanup_request (uuid, text, boolean), public.rh_storage_cleanup_claim (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_storage_cleanup_request (uuid, text, boolean) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rh_storage_cleanup_claim (uuid) TO service_role;

GRANT SELECT, UPDATE ON rh_storage_cleanup TO service_role;

CREATE POLICY rh_cleanup_read ON rh_storage_cleanup
  FOR SELECT TO authenticated
    USING (rh_member (organization_id)
      AND (user_id = auth.uid () OR rh_can (organization_id, 'documents', 'manage')));

GRANT SELECT ON rh_storage_cleanup TO authenticated;

