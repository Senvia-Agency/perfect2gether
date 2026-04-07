ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check 
  CHECK (status = ANY (ARRAY['pending','in_progress','fulfilled','delivered','cancelled']));