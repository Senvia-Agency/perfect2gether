ALTER TABLE public.crm_clients
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_clients
  DROP CONSTRAINT IF EXISTS crm_clients_source_metadata_is_object;
ALTER TABLE public.crm_clients
  ADD CONSTRAINT crm_clients_source_metadata_is_object
  CHECK (jsonb_typeof(source_metadata) = 'object');

CREATE OR REPLACE FUNCTION public.check_client_crc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.crc_code IS NOT NULL
    AND NEW.crc_code !~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$'
  THEN
    RAISE EXCEPTION 'Código CRC inválido (0000-0000-0000)' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_p2g_lead_to_client(
  _lead uuid,
  _won_status text DEFAULT NULL
)
RETURNS TABLE(
  client_id uuid,
  client_created boolean,
  client_record public.crm_clients
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source_lead public.leads%ROWTYPE;
  target_client public.crm_clients%ROWTYPE;
  fiscal_nif text;
  cpe_value text;
  cpe_list jsonb;
  created boolean := false;
  lead_custom_data jsonb;
  lead_metadata jsonb;
  incoming_cae jsonb;
  origin_entry jsonb;
  origins jsonb;
  incoming_source_metadata jsonb;
  merged_source_metadata jsonb;
  lead_decision_makers jsonb;
  first_decision_maker_name text;
  group_name text;
  group_people jsonb;
  person jsonb;
  person_index integer;
  person_id uuid;
  person_raw_name text;
  person_raw_nif text;
  person_raw_phone text;
  person_raw_email text;
  person_name text;
  person_nif text;
  person_phone text;
  person_email text;
  person_role text;
  person_source text;
  person_source_ref text;
  person_source_metadata jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.p2g_mfa_ok() IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão autorizada necessária.' USING ERRCODE = '42501';
  END IF;

  SELECT lead.*
  INTO source_lead
  FROM public.leads AS lead
  WHERE lead.id = _lead
  FOR UPDATE;

  IF NOT FOUND
    OR source_lead.organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR source_lead.organization_id <> public.get_user_org_id(auth.uid())
    OR public.p2g_can_read_lead(source_lead.organization_id, source_lead.assigned_to) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Lead indisponível para conversão.' USING ERRCODE = '42501';
  END IF;

  IF _won_status IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.pipeline_stages AS stage
    WHERE stage.organization_id = source_lead.organization_id
      AND stage.key = _won_status
      AND (
        stage.is_final_positive
        OR lower(stage.name) ~ '(ganho|won|fechado|closed)'
      )
  ) THEN
    RAISE EXCEPTION 'Selecione uma etapa de lead ganha.' USING ERRCODE = '22023';
  END IF;

  fiscal_nif := nullif(regexp_replace(
    coalesce(source_lead.company_nif, ''),
    '[[:space:]]',
    '',
    'g'
  ), '');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    source_lead.organization_id::text
      || ':conversion:'
      || coalesce(fiscal_nif, _lead::text),
    0
  ));

  SELECT client.*
  INTO target_client
  FROM public.crm_clients AS client
  WHERE client.organization_id = source_lead.organization_id
    AND (
      client.lead_id = _lead
      OR (
        fiscal_nif IS NOT NULL
        AND coalesce(
          nullif(regexp_replace(client.company_nif, '[[:space:]]', '', 'g'), ''),
          nullif(regexp_replace(client.nif, '[[:space:]]', '', 'g'), '')
        ) = fiscal_nif
      )
    )
  ORDER BY (client.lead_id = _lead) DESC NULLS LAST, client.created_at, client.id
  LIMIT 1
  FOR UPDATE;

  IF target_client.id IS NULL THEN
    IF public.has_module_permission(
      source_lead.organization_id,
      'clients',
      'list',
      'add'
    ) IS NOT TRUE THEN
      RAISE EXCEPTION 'Sem permissão para criar o cliente.' USING ERRCODE = '42501';
    END IF;
  ELSIF public.app_can_view_client(target_client.id) IS NOT TRUE
    OR public.has_module_permission(
      source_lead.organization_id,
      'clients',
      'list',
      'edit'
    ) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Cliente indisponível para conversão.' USING ERRCODE = '42501';
  END IF;

  lead_custom_data := CASE
    WHEN jsonb_typeof(source_lead.custom_data) = 'object'
      THEN source_lead.custom_data
    ELSE '{}'::jsonb
  END;
  lead_metadata := CASE
    WHEN jsonb_typeof(lead_custom_data->'metadata') = 'object'
      THEN lead_custom_data->'metadata'
    ELSE '{}'::jsonb
  END;
  lead_decision_makers := CASE
    WHEN jsonb_typeof(lead_custom_data->'decision_makers') = 'array'
      THEN lead_custom_data->'decision_makers'
    ELSE '[]'::jsonb
  END;
  incoming_cae := CASE
    WHEN jsonb_typeof(lead_metadata->'cae') = 'object'
      THEN lead_metadata->'cae'
    ELSE '{}'::jsonb
  END;

  SELECT item->>'name'
  INTO first_decision_maker_name
  FROM jsonb_array_elements(lead_decision_makers) AS entry(item)
  WHERE jsonb_typeof(item) = 'object'
    AND nullif(btrim(item->>'name'), '') IS NOT NULL
  LIMIT 1;

  origin_entry := jsonb_strip_nulls(jsonb_build_object(
    'lead_id', source_lead.id,
    'lead_source', nullif(btrim(source_lead.source), ''),
    'prospect_id', lead_custom_data->>'prospect_id',
    'source_file_name', nullif(btrim(lead_custom_data->>'source_file_name'), ''),
    'source_portal', nullif(btrim(lead_metadata->>'source_portal'), ''),
    'publication_date', nullif(btrim(lead_metadata->>'publication_date'), '')
  ));
  incoming_source_metadata := origin_entry;

  merged_source_metadata := CASE
    WHEN target_client.id IS NOT NULL
      AND jsonb_typeof(target_client.source_metadata) = 'object'
      THEN target_client.source_metadata
    ELSE '{}'::jsonb
  END;
  origins := CASE
    WHEN jsonb_typeof(merged_source_metadata->'origins') = 'array'
      THEN merged_source_metadata->'origins'
    ELSE '[]'::jsonb
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(origins) AS existing_origin(item)
    WHERE item->>'lead_id' = source_lead.id::text
  ) THEN
    origins := origins || jsonb_build_array(origin_entry);
  END IF;

  merged_source_metadata := incoming_source_metadata
    || merged_source_metadata
    || jsonb_build_object('origins', origins);

  IF incoming_cae <> '{}'::jsonb THEN
    IF jsonb_typeof(merged_source_metadata->'cae') IS DISTINCT FROM 'object'
      OR merged_source_metadata->'cae' = '{}'::jsonb
    THEN
      merged_source_metadata := merged_source_metadata || jsonb_build_object(
        'cae', incoming_cae,
        'cae_source', coalesce(nullif(lead_metadata->>'source_portal', ''), 'lead')
      );
    ELSIF merged_source_metadata->'cae' IS DISTINCT FROM incoming_cae THEN
      merged_source_metadata := merged_source_metadata || jsonb_build_object(
        'cae_review', jsonb_strip_nulls(jsonb_build_object(
          'incoming', incoming_cae,
          'source_portal', nullif(lead_metadata->>'source_portal', ''),
          'publication_date', nullif(lead_metadata->>'publication_date', ''),
          'lead_id', source_lead.id
        ))
      );
    END IF;
  END IF;

  IF target_client.id IS NULL THEN
    INSERT INTO public.crm_clients(
      organization_id,
      lead_id,
      name,
      email,
      phone,
      company,
      company_nif,
      notes,
      assigned_to,
      source,
      status,
      decision_makers,
      decision_maker_name,
      source_metadata
    ) VALUES (
      source_lead.organization_id,
      _lead,
      coalesce(nullif(source_lead.name, ''), source_lead.company_name, 'Sem nome'),
      source_lead.email,
      source_lead.phone,
      source_lead.company_name,
      source_lead.company_nif,
      source_lead.notes,
      source_lead.assigned_to,
      'lead',
      'active',
      lead_decision_makers,
      first_decision_maker_name,
      merged_source_metadata
    )
    RETURNING * INTO target_client;
    created := true;
  ELSE
    UPDATE public.crm_clients AS client
    SET source_metadata = merged_source_metadata,
        decision_makers = CASE
          WHEN client.decision_makers = '[]'::jsonb
            THEN lead_decision_makers
          ELSE client.decision_makers
        END,
        decision_maker_name = CASE
          WHEN nullif(btrim(client.decision_maker_name), '') IS NULL
            THEN first_decision_maker_name
          ELSE client.decision_maker_name
        END
    WHERE client.id = target_client.id
    RETURNING client.* INTO target_client;
  END IF;

  FOREACH group_name IN ARRAY ARRAY['decision_makers', 'gerentes', 'socios']
  LOOP
    CASE group_name
      WHEN 'decision_makers' THEN
        group_people := lead_decision_makers;
        person_role := 'decision_maker';
        person_source := 'legacy';
      WHEN 'gerentes' THEN
        group_people := CASE
          WHEN jsonb_typeof(lead_metadata->'gerentes') = 'array'
            THEN lead_metadata->'gerentes'
          ELSE '[]'::jsonb
        END;
        person_role := 'legal_manager';
        person_source := 'mj';
      WHEN 'socios' THEN
        group_people := CASE
          WHEN jsonb_typeof(lead_metadata->'socios') = 'array'
            THEN lead_metadata->'socios'
          ELSE '[]'::jsonb
        END;
        person_role := 'shareholder';
        person_source := 'mj';
    END CASE;

    FOR person, person_index IN
      SELECT item, ordinality::integer
      FROM jsonb_array_elements(group_people) WITH ORDINALITY AS entries(item, ordinality)
    LOOP
      IF jsonb_typeof(person) <> 'object' THEN
        CONTINUE;
      END IF;
      person_raw_name := coalesce(
        person->>'name',
        person->>'nome',
        ''
      );
      person_name := left(btrim(regexp_replace(
        person_raw_name,
        '[[:space:]]+',
        ' ',
        'g'
      )), 200);
      IF person_name = '' THEN
        CONTINUE;
      END IF;
      person_raw_nif := nullif(btrim(person->>'nif'), '');
      person_nif := nullif(regexp_replace(
        coalesce(person_raw_nif, ''),
        '[^0-9]',
        '',
        'g'
      ), '');
      IF person_nif !~ '^[0-9]{9}$' THEN
        person_nif := NULL;
      END IF;
      person_raw_phone := coalesce(
        nullif(btrim(person->>'phone'), ''),
        nullif(btrim(person->>'telefone'), '')
      );
      person_phone := left(person_raw_phone, 40);
      person_raw_email := nullif(btrim(person->>'email'), '');
      person_email := left(person_raw_email, 320);
      person_source_ref := 'lead:'
        || source_lead.id::text
        || ':'
        || group_name
        || ':'
        || person_index::text;
      person_source_metadata := jsonb_strip_nulls(jsonb_build_object(
        'lead_id', source_lead.id,
        'source_portal', nullif(lead_metadata->>'source_portal', ''),
        'group', group_name,
        'legacy_input', nullif(jsonb_strip_nulls(jsonb_build_object(
          'name', CASE WHEN person_name <> person_raw_name THEN person_raw_name END,
          'nif', CASE WHEN person_raw_nif IS NOT NULL AND person_nif IS NULL THEN person_raw_nif END,
          'phone', CASE WHEN person_phone <> person_raw_phone THEN person_raw_phone END,
          'email', CASE WHEN person_email <> person_raw_email THEN person_raw_email END
        )), '{}'::jsonb)
      ));

      person_id := NULL;
      IF person_nif IS NOT NULL THEN
        SELECT existing_person.id
        INTO person_id
        FROM public.client_people AS existing_person
        WHERE existing_person.client_id = target_client.id
          AND existing_person.nif = person_nif
        FOR UPDATE;
      ELSE
        SELECT existing_person.id
        INTO person_id
        FROM public.client_people AS existing_person
        WHERE existing_person.client_id = target_client.id
          AND existing_person.source_ref = person_source_ref
        FOR UPDATE;
      END IF;

      IF person_id IS NULL THEN
        INSERT INTO public.client_people(
          organization_id,
          client_id,
          name,
          nif,
          phone,
          email,
          source,
          source_ref,
          source_metadata,
          created_by
        ) VALUES (
          source_lead.organization_id,
          target_client.id,
          person_name,
          person_nif,
          person_phone,
          person_email,
          person_source,
          person_source_ref,
          person_source_metadata || jsonb_build_object(
            'origins',
            jsonb_build_array(person_source_metadata)
          ),
          auth.uid()
        )
        RETURNING id INTO person_id;
      ELSE
        UPDATE public.client_people AS existing_person
        SET phone = coalesce(nullif(existing_person.phone, ''), person_phone),
            email = coalesce(nullif(existing_person.email, ''), person_email),
            source_metadata = existing_person.source_metadata || jsonb_build_object(
              'origins',
              CASE
                WHEN jsonb_typeof(existing_person.source_metadata->'origins') = 'array'
                  AND existing_person.source_metadata->'origins' @> jsonb_build_array(person_source_metadata)
                  THEN existing_person.source_metadata->'origins'
                WHEN jsonb_typeof(existing_person.source_metadata->'origins') = 'array'
                  THEN existing_person.source_metadata->'origins' || jsonb_build_array(person_source_metadata)
                ELSE jsonb_build_array(person_source_metadata)
              END
            )
        WHERE existing_person.id = person_id;
      END IF;

      INSERT INTO public.client_person_roles(
        person_id,
        client_id,
        organization_id,
        role,
        source
      ) VALUES (
        person_id,
        target_client.id,
        source_lead.organization_id,
        person_role,
        person_source
      )
      ON CONFLICT ON CONSTRAINT client_person_roles_pkey DO NOTHING;
    END LOOP;
  END LOOP;

  cpe_list := CASE
    WHEN jsonb_typeof(lead_custom_data->'cpes') = 'array'
      THEN lead_custom_data->'cpes'
    WHEN jsonb_typeof(lead_custom_data->'cpe') = 'string'
      THEN jsonb_build_array(lead_custom_data->'cpe')
    ELSE '[]'::jsonb
  END;
  FOR cpe_value IN
    SELECT DISTINCT upper(regexp_replace(value #>> '{}', '[[:space:]]', '', 'g'))
    FROM jsonb_array_elements(cpe_list)
    WHERE jsonb_typeof(value) = 'string'
    ORDER BY 1
  LOOP
    IF cpe_value = '' THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.cpes AS equipment
      WHERE equipment.organization_id = source_lead.organization_id
        AND equipment.client_id = target_client.id
        AND lower(btrim(equipment.equipment_type)) NOT IN ('serviços', 'servicos')
        AND upper(regexp_replace(
          coalesce(equipment.serial_number, ''),
          '[[:space:]]',
          '',
          'g'
        )) = cpe_value
    ) THEN
      IF public.has_module_permission(
        source_lead.organization_id,
        'clients',
        'cpes',
        'add'
      ) IS NOT TRUE THEN
        RAISE EXCEPTION 'Sem permissão para criar CPE.' USING ERRCODE = '42501';
      END IF;
      INSERT INTO public.cpes(
        organization_id,
        client_id,
        equipment_type,
        serial_number,
        comercializador,
        status,
        notes
      ) VALUES (
        source_lead.organization_id,
        target_client.id,
        'Energia',
        cpe_value,
        'Outro',
        'active',
        'Criado automaticamente na conversão da Lead #' || left(_lead::text, 8)
      );
    END IF;
  END LOOP;

  UPDATE public.proposals AS proposal
  SET client_id = target_client.id
  WHERE proposal.organization_id = source_lead.organization_id
    AND proposal.lead_id = _lead
    AND proposal.client_id IS NULL
    AND public.has_module_permission(
      source_lead.organization_id,
      'proposals',
      'proposals',
      'edit'
    )
    AND (
      public.can_manage_sales_for_organization(source_lead.organization_id)
      OR NOT EXISTS (
        SELECT 1 FROM public.sales AS sale WHERE sale.proposal_id = proposal.id
      )
    );

  IF public.has_module_permission(source_lead.organization_id, 'sales', 'sales', 'edit')
    AND public.can_manage_sales_for_organization(source_lead.organization_id)
  THEN
    UPDATE public.sales AS sale
    SET client_id = target_client.id
    WHERE sale.organization_id = source_lead.organization_id
      AND sale.lead_id = _lead
      AND sale.client_id IS NULL;
  END IF;

  IF _won_status IS NOT NULL THEN
    UPDATE public.leads AS lead
    SET status = _won_status
    WHERE lead.id = _lead
    RETURNING lead.* INTO source_lead;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sem permissão para atualizar a lead.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY SELECT target_client.id, created, target_client;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_p2g_lead_to_client(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_p2g_lead_to_client(uuid, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
