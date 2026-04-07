
ALTER TABLE public.organizations 
ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

-- Backfill existing non-exempt organizations
UPDATE public.organizations 
SET trial_ends_at = created_at + interval '14 days'
WHERE billing_exempt = false OR billing_exempt IS NULL;

-- Exempt organizations don't need trial
UPDATE public.organizations 
SET trial_ends_at = NULL
WHERE billing_exempt = true;
