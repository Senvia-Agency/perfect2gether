-- Preserve reads, existing managers and other organizations; freeze saved P2G commitments for employees.
BEGIN;
CREATE FUNCTION public.p2g_commitment_calendar_month()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE existing_month date;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.month IS NOT DISTINCT FROM OLD.month THEN RETURN NEW; END IF;
 END IF;
 IF NEW.organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid THEN
   NEW.month:=date_trunc('month',NEW.month)::date;
   IF TG_OP='INSERT' AND auth.role()='authenticated' THEN
     SELECT mc.month INTO existing_month FROM public.monthly_commitments mc
     WHERE mc.organization_id=NEW.organization_id AND mc.user_id=NEW.user_id
       AND mc.month>=NEW.month AND mc.month<(NEW.month+interval '1 month')::date
     ORDER BY mc.month LIMIT 1;
     IF FOUND THEN
       IF public.can_manage_org_commitments(NEW.organization_id) THEN
         NEW.month:=existing_month;
       ELSE
         RAISE EXCEPTION 'Já registou o compromisso deste mês.' USING ERRCODE='23505';
       END IF;
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.p2g_commitment_calendar_month() FROM PUBLIC;
CREATE TRIGGER p2g_commitment_calendar_month BEFORE INSERT OR UPDATE OF month ON public.monthly_commitments
FOR EACH ROW EXECUTE FUNCTION public.p2g_commitment_calendar_month();

CREATE POLICY p2g_saved_commitment_update ON public.monthly_commitments AS RESTRICTIVE FOR UPDATE TO authenticated
USING (organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(organization_id))
WITH CHECK (organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(organization_id));
CREATE POLICY p2g_saved_commitment_delete ON public.monthly_commitments AS RESTRICTIVE FOR DELETE TO authenticated
USING (organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(organization_id));

CREATE POLICY p2g_saved_commitment_lines_insert ON public.commitment_lines AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.monthly_commitments mc WHERE mc.id=commitment_id
 AND (mc.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(mc.organization_id))));
CREATE POLICY p2g_saved_commitment_lines_update ON public.commitment_lines AS RESTRICTIVE FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.monthly_commitments mc WHERE mc.id=commitment_id
 AND (mc.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(mc.organization_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.monthly_commitments mc WHERE mc.id=commitment_id
 AND (mc.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(mc.organization_id))));
CREATE POLICY p2g_saved_commitment_lines_delete ON public.commitment_lines AS RESTRICTIVE FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.monthly_commitments mc WHERE mc.id=commitment_id
 AND (mc.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR public.can_manage_org_commitments(mc.organization_id))));
COMMIT;
NOTIFY pgrst, 'reload schema';
