-- Scheduled MJ prospect runs (Apify schedule + webhook) have no requesting user.
ALTER TABLE public.prospect_generation_jobs ALTER COLUMN user_id DROP NOT NULL;

-- One job per Apify run, so repeated webhook deliveries cannot import twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_prospect_generation_jobs_apify_run
  ON public.prospect_generation_jobs (apify_run_id)
  WHERE apify_run_id IS NOT NULL;
