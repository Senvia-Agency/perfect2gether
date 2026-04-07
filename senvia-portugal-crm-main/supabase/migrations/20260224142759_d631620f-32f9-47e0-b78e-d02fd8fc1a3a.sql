-- Forçar recriação limpa da policy de INSERT
DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.internal_requests;

CREATE POLICY "Authenticated users can create requests"
ON public.internal_requests
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_org_id(auth.uid())
  AND submitted_by = auth.uid()
);

-- Forçar PostgREST a recarregar schema/policies
NOTIFY pgrst, 'reload schema';