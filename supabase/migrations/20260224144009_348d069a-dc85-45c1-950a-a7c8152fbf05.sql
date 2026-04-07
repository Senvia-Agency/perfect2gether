-- Garantir idempotência
DROP POLICY IF EXISTS "Super admin full access internal_requests" ON public.internal_requests;

CREATE POLICY "Super admin full access internal_requests"
ON public.internal_requests
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Garantir refresh imediato das policies no API layer
NOTIFY pgrst, 'reload schema';