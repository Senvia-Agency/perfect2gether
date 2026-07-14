-- Backfill client_id on proposals/sales created from leads that were later converted to clients.
-- Also set sales.proposal_type DEFAULT 'energia' and backfill NULLs.
-- Idempotent: only updates rows where the target column IS NULL.

-- C2: Backfill historical client_id on proposals via lead_id -> crm_clients.lead_id mapping
UPDATE public.proposals p
SET client_id = c.id
FROM public.crm_clients c
WHERE p.lead_id = c.lead_id
  AND p.client_id IS NULL
  AND c.lead_id IS NOT NULL;

-- C2: Backfill historical client_id on sales via lead_id -> crm_clients.lead_id mapping
UPDATE public.sales s
SET client_id = c.id
FROM public.crm_clients c
WHERE s.lead_id = c.lead_id
  AND s.client_id IS NULL
  AND c.lead_id IS NOT NULL;

-- C3: Set DEFAULT 'energia' on sales.proposal_type (was added without default in migration 20260123115432)
ALTER TABLE public.sales ALTER COLUMN proposal_type SET DEFAULT 'energia';

-- C3: Backfill sales.proposal_type NULLs from linked proposal.proposal_type
UPDATE public.sales s
SET proposal_type = p.proposal_type
FROM public.proposals p
WHERE s.proposal_id = p.id
  AND s.proposal_type IS NULL
  AND p.proposal_type IS NOT NULL;

-- C3: Backfill remaining sales.proposal_type NULLs to 'energia'
UPDATE public.sales
SET proposal_type = 'energia'
WHERE proposal_type IS NULL;

-- C3 (defensive): Backfill proposals.proposal_type NULLs to 'energia'
-- (column has DEFAULT 'energia' since migration 20260123093724, but legacy rows may have NULL)
UPDATE public.proposals
SET proposal_type = 'energia'
WHERE proposal_type IS NULL;
