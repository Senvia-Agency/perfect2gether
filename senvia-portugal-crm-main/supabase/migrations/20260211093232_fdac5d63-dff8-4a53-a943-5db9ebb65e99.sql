ALTER TABLE public.sales ADD COLUMN qr_code_url text DEFAULT NULL;
ALTER TABLE public.sale_payments ADD COLUMN qr_code_url text DEFAULT NULL;