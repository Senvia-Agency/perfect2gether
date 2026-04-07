
-- Add renewal_status column to cpes table
ALTER TABLE public.cpes ADD COLUMN renewal_status text DEFAULT null;

-- Create index for filtering alerts
CREATE INDEX idx_cpes_renewal_alerts ON public.cpes (organization_id, status, fidelizacao_end, renewal_status) 
WHERE status = 'active' AND fidelizacao_end IS NOT NULL;
