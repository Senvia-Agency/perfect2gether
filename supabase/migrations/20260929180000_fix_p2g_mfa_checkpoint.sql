BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_p2g_mfa()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated'
    OR current_setting('request.path', true) IN (
      'rpc/p2g_mfa_required', '/rpc/p2g_mfa_required'
    )
  THEN
    RETURN;
  END IF;

  IF NOT public.p2g_mfa_ok() THEN
    RAISE insufficient_privilege USING MESSAGE = 'Confirme a autenticação de dois fatores para continuar.';
  END IF;
END;
$function$;

CREATE POLICY "P2G requires MFA for realtime proposal CPEs"
ON public.proposal_cpes AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.p2g_mfa_ok()))
WITH CHECK ((SELECT public.p2g_mfa_ok()));

COMMIT;
