BEGIN;

-- Keep the rollout disabled until the enrollment screen and API guards are live.
CREATE TABLE public.organization_security_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  require_mfa boolean NOT NULL DEFAULT false
);
ALTER TABLE public.organization_security_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_security_settings FROM anon, authenticated;
INSERT INTO public.organization_security_settings (organization_id)
VALUES ('96a3950e-31be-4c6d-abed-b82968c0d7e9');

CREATE FUNCTION public.p2g_mfa_required()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_security_settings s
    WHERE s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'
      AND s.require_mfa
      AND auth.uid() IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.organization_members m
          WHERE m.organization_id = s.organization_id
            AND m.user_id = auth.uid()
            AND m.is_active
        )
        OR EXISTS (
          SELECT 1 FROM public.user_roles r
          WHERE r.user_id = auth.uid() AND r.role = 'super_admin'
        )
      )
  );
$function$;

CREATE FUNCTION public.p2g_mfa_ok()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT NOT public.p2g_mfa_required()
    OR (
      auth.jwt()->>'aal' = 'aal2'
      AND EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid()
          AND f.factor_type = 'totp'
          AND f.status = 'verified'
      )
    );
$function$;

CREATE FUNCTION public.enforce_p2g_mfa()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated'
    OR current_setting('request.path', true) = 'rpc/p2g_mfa_required'
  THEN
    RETURN;
  END IF;

  IF NOT public.p2g_mfa_ok() THEN
    RAISE insufficient_privilege USING MESSAGE = 'Confirme a autenticação de dois fatores para continuar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.p2g_mfa_required(), public.p2g_mfa_ok(), public.enforce_p2g_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.p2g_mfa_required(), public.p2g_mfa_ok() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_p2g_mfa() TO anon, authenticated, service_role;

-- Realtime and Storage do not pass through PostgREST's pre-request hook.
CREATE POLICY "P2G requires MFA for realtime leads"
ON public.leads AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.p2g_mfa_ok()))
WITH CHECK ((SELECT public.p2g_mfa_ok()));
CREATE POLICY "P2G requires MFA for realtime proposals"
ON public.proposals AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.p2g_mfa_ok()))
WITH CHECK ((SELECT public.p2g_mfa_ok()));
CREATE POLICY "P2G requires MFA for realtime sales"
ON public.sales AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.p2g_mfa_ok()))
WITH CHECK ((SELECT public.p2g_mfa_ok()));
CREATE POLICY "P2G requires MFA for storage"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.p2g_mfa_ok()))
WITH CHECK ((SELECT public.p2g_mfa_ok()));

COMMIT;
