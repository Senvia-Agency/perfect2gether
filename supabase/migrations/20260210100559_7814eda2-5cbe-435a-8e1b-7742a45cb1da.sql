ALTER TABLE public.sales
  ADD COLUMN invoicexpress_id bigint,
  ADD COLUMN invoicexpress_type text DEFAULT 'invoice_receipts';