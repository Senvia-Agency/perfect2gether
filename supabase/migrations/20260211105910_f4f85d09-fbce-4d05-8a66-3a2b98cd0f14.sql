
CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  invoicexpress_id integer NOT NULL,
  reference text,
  status text,
  client_name text,
  total numeric DEFAULT 0,
  date date,
  related_invoice_id integer,
  sale_id uuid REFERENCES public.sales(id),
  payment_id uuid REFERENCES public.sale_payments(id),
  pdf_path text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, invoicexpress_id)
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org credit notes"
  ON public.credit_notes FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Super admin full access credit_notes"
  ON public.credit_notes FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));
