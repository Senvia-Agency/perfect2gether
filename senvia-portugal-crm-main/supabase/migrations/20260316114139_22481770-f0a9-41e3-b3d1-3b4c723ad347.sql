CREATE TABLE public.renewal_automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  renewal_date DATE NOT NULL,
  renewal_payment_id UUID NULL REFERENCES public.sale_payments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  sent_at TIMESTAMP WITH TIME ZONE NULL,
  failed_at TIMESTAMP WITH TIME ZONE NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT renewal_automation_runs_status_check CHECK (status IN ('processing', 'sent', 'failed')),
  CONSTRAINT renewal_automation_runs_unique UNIQUE (sale_id, template_id, trigger_type, renewal_date)
);

CREATE INDEX idx_renewal_automation_runs_lookup
  ON public.renewal_automation_runs (organization_id, trigger_type, renewal_date);

CREATE INDEX idx_renewal_automation_runs_sale
  ON public.renewal_automation_runs (sale_id, renewal_date DESC);

ALTER TABLE public.renewal_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_renewal_automation_runs_updated_at
BEFORE UPDATE ON public.renewal_automation_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.acquire_renewal_automation_run(
  p_organization_id UUID,
  p_sale_id UUID,
  p_template_id UUID,
  p_trigger_type TEXT,
  p_renewal_date DATE,
  p_renewal_payment_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.renewal_automation_runs (
    organization_id,
    sale_id,
    template_id,
    trigger_type,
    renewal_date,
    renewal_payment_id,
    status
  )
  VALUES (
    p_organization_id,
    p_sale_id,
    p_template_id,
    p_trigger_type,
    p_renewal_date,
    p_renewal_payment_id,
    'processing'
  )
  ON CONFLICT (sale_id, template_id, trigger_type, renewal_date) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_renewal_automation_run(
  p_run_id UUID,
  p_status TEXT,
  p_last_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.renewal_automation_runs
  SET
    status = p_status,
    last_error = p_last_error,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    failed_at = CASE WHEN p_status = 'failed' THEN now() ELSE failed_at END,
    updated_at = now()
  WHERE id = p_run_id;
END;
$$;