
CREATE TABLE public.prospect_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  apify_run_id text,
  status text NOT NULL DEFAULT 'pending',
  search_params jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.prospect_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read their jobs"
  ON public.prospect_generation_jobs
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert jobs"
  ON public.prospect_generation_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service role can update jobs"
  ON public.prospect_generation_jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
