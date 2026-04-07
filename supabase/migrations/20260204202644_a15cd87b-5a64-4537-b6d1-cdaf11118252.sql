-- Create table for sale payments (multiple installments per sale)
CREATE TABLE public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  invoice_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_sale_payments_sale_id ON public.sale_payments(sale_id);
CREATE INDEX idx_sale_payments_organization_id ON public.sale_payments(organization_id);

-- Enable Row Level Security
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org payments"
  ON public.sale_payments FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert payments"
  ON public.sale_payments FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update payments"
  ON public.sale_payments FOR UPDATE
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete payments"
  ON public.sale_payments FOR DELETE
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Super admin full access sale_payments"
  ON public.sale_payments FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_sale_payments_updated_at
  BEFORE UPDATE ON public.sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing payment data (if sale was marked as paid or has invoice)
INSERT INTO public.sale_payments (organization_id, sale_id, amount, payment_date, payment_method, invoice_reference, status, notes)
SELECT 
  organization_id,
  id as sale_id,
  total_value as amount,
  COALESCE(paid_date, sale_date) as payment_date,
  payment_method,
  invoice_reference,
  CASE WHEN payment_status = 'paid' THEN 'paid' ELSE 'pending' END as status,
  NULL as notes
FROM public.sales
WHERE payment_status = 'paid' OR invoice_reference IS NOT NULL;