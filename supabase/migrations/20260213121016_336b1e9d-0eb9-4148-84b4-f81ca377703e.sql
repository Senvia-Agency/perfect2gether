
ALTER TABLE public.crm_clients ADD COLUMN company_nif text;
ALTER TABLE public.crm_clients ADD COLUMN billing_target text NOT NULL DEFAULT 'client';
