ALTER TABLE public.proposals ADD COLUMN rejection_meeting_snapshot jsonb;

UPDATE public.proposals p
SET rejection_meeting_snapshot = jsonb_build_object(
  'id', e.id, 'organization_id', e.organization_id, 'user_id', e.user_id,
  'proposal_id', e.proposal_id, 'client_id', e.client_id, 'lead_id', e.lead_id,
  'title', e.title, 'description', e.description, 'event_type', e.event_type,
  'start_time', e.start_time, 'end_time', e.end_time, 'status', e.status,
  'meeting_link', e.meeting_link, 'rejection_reason', p.rejection_reason,
  'recorded_at', now())
FROM public.calendar_events e
WHERE p.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND p.status = 'rejected' AND nullif(btrim(p.rejection_reason), '') IS NOT NULL
  AND e.id = p.rejection_meeting_id AND e.organization_id = p.organization_id
  AND e.proposal_id = p.id AND e.event_type = 'meeting'
  AND e.client_id IS NOT DISTINCT FROM p.client_id
  AND e.lead_id IS NOT DISTINCT FROM p.lead_id AND e.end_time > e.start_time;

CREATE FUNCTION public.retain_p2g_rejection_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE snapshot jsonb; previous_snapshot jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.rejection_meeting_snapshot->>'organization_id' = '96a3950e-31be-4c6d-abed-b82968c0d7e9' THEN
      IF NEW.rejection_meeting_snapshot IS DISTINCT FROM OLD.rejection_meeting_snapshot THEN
        RAISE EXCEPTION 'O registo original da recusa não pode ser alterado';
      END IF;
      IF OLD.status IS DISTINCT FROM 'rejected' AND NEW.status = 'rejected'
        AND NEW.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid THEN
        previous_snapshot := OLD.rejection_meeting_snapshot;
      ELSE
        IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
          RAISE EXCEPTION 'O registo original da recusa não pode ser alterado';
        END IF;
        IF NEW.rejection_meeting_id IS DISTINCT FROM OLD.rejection_meeting_id THEN
          -- Only the FK action during calendar deletion may clear the live link.
          IF NOT (NEW.rejection_meeting_id IS NULL AND pg_trigger_depth() > 1
            AND NOT EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = OLD.rejection_meeting_id)) THEN
            RAISE EXCEPTION 'A reunião original da recusa não pode ser substituída';
          END IF;
        END IF;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    AND NEW.status = 'rejected' AND nullif(btrim(NEW.rejection_reason), '') IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', e.id, 'organization_id', e.organization_id, 'user_id', e.user_id,
      'proposal_id', e.proposal_id, 'client_id', e.client_id, 'lead_id', e.lead_id,
      'title', e.title, 'description', e.description, 'event_type', e.event_type,
      'start_time', e.start_time, 'end_time', e.end_time, 'status', e.status,
      'meeting_link', e.meeting_link, 'rejection_reason', NEW.rejection_reason,
      'recorded_at', now()) INTO snapshot
    FROM public.calendar_events e
    WHERE e.id = NEW.rejection_meeting_id AND e.organization_id = NEW.organization_id
      AND e.proposal_id = NEW.id AND e.event_type = 'meeting'
      AND e.client_id IS NOT DISTINCT FROM NEW.client_id
      AND e.lead_id IS NOT DISTINCT FROM NEW.lead_id AND e.end_time > e.start_time;
  END IF;
  IF NEW.rejection_meeting_snapshot IS NOT NULL AND previous_snapshot IS NULL THEN
    RAISE EXCEPTION 'O registo da recusa é criado automaticamente';
  END IF;
  NEW.rejection_meeting_snapshot := CASE WHEN previous_snapshot IS NULL THEN snapshot
    ELSE snapshot || jsonb_build_object('previous', previous_snapshot) END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.retain_p2g_rejection_audit() FROM PUBLIC, anon, authenticated;

-- The existing require_p2g_rejection_meeting trigger validates a new refusal first.
CREATE TRIGGER retain_p2g_rejection_audit BEFORE INSERT OR UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.retain_p2g_rejection_audit();

COMMENT ON COLUMN public.proposals.rejection_meeting_snapshot IS
  'Immutable refusal meeting and reason, with earlier refusal snapshots under previous; independent of the live calendar.';
NOTIFY pgrst, 'reload schema';
