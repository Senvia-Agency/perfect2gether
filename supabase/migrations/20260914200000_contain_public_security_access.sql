BEGIN;

-- Preserve organization switching before the selected organization reaches the JWT.
DROP POLICY IF EXISTS "Active members can view organizations" ON public.organizations;
CREATE POLICY "Active members can view organizations"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), id));

DROP POLICY IF EXISTS "Public can verify organization by slug" ON public.organizations;

ALTER POLICY "Service role can insert stripe commission records"
ON public.stripe_commission_records TO service_role;

ALTER POLICY "Org members can insert jobs"
ON public.prospect_generation_jobs TO service_role
WITH CHECK (true);

ALTER POLICY "Service role can update jobs"
ON public.prospect_generation_jobs TO service_role;

-- Keep the existing organization boundary and all commitment write policies.
DROP POLICY IF EXISTS "Commitments respect user data scope" ON public.monthly_commitments;
CREATE POLICY "Commitments respect user data scope"
ON public.monthly_commitments AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.app_can_view_user_data(user_id));

COMMIT;
