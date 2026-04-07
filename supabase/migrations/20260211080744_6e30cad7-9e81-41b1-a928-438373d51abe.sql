ALTER TABLE public.products ADD COLUMN tax_value NUMERIC DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN tax_exemption_reason TEXT DEFAULT NULL;