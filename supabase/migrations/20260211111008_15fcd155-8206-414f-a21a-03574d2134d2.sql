
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  invoicexpress_id integer NOT NULL,
  reference text,
  document_type text DEFAULT 'invoice',
  status text,
  client_name text,
  total numeric DEFAULT 0,
  date date,
  due_date date,
  sale_id uuid REFERENCES sales(id),
  payment_id uuid REFERENCES sale_payments(id),
  pdf_path text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, invoicexpress_id)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoices"
  ON public.invoices FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Super admins can view all invoices"
  ON public.invoices FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));
