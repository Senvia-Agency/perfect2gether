
-- Add credit note fields to sale_payments
ALTER TABLE public.sale_payments ADD COLUMN IF NOT EXISTS credit_note_id integer;
ALTER TABLE public.sale_payments ADD COLUMN IF NOT EXISTS credit_note_reference text;

-- Add credit note fields to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_note_id integer;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_note_reference text;
