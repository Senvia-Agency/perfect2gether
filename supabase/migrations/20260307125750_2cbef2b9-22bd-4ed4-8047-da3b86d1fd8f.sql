
-- Add client_org_id to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_org_id uuid REFERENCES public.organizations(id);

-- Create stripe_commission_records table
CREATE TABLE public.stripe_commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  user_id uuid NOT NULL,
  client_org_id uuid NOT NULL REFERENCES public.organizations(id),
  amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  stripe_invoice_id text,
  period_start text,
  period_end text,
  plan text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_commission_records ENABLE ROW LEVEL SECURITY;

-- RLS policy: org members can view
CREATE POLICY "Members can view stripe commission records"
  ON public.stripe_commission_records
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- RLS policy: service role can insert (webhook)
CREATE POLICY "Service role can insert stripe commission records"
  ON public.stripe_commission_records
  FOR INSERT
  WITH CHECK (true);
