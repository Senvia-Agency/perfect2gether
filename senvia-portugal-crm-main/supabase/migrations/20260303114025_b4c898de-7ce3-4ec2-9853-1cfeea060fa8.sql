
-- Add summary columns to monthly_commitments
ALTER TABLE public.monthly_commitments
  ADD COLUMN IF NOT EXISTS total_nifs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_energia_mwh numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_solar_kwp numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_comissao numeric NOT NULL DEFAULT 0;

-- Migrate existing data from commitment_lines
UPDATE public.monthly_commitments mc SET
  total_nifs = COALESCE((SELECT COUNT(*) FROM public.commitment_lines cl WHERE cl.commitment_id = mc.id), 0),
  total_energia_mwh = COALESCE((SELECT SUM(cl.energia_mwh) FROM public.commitment_lines cl WHERE cl.commitment_id = mc.id), 0),
  total_solar_kwp = COALESCE((SELECT SUM(cl.solar_kwp) FROM public.commitment_lines cl WHERE cl.commitment_id = mc.id), 0),
  total_comissao = COALESCE((SELECT SUM(cl.comissao) FROM public.commitment_lines cl WHERE cl.commitment_id = mc.id), 0);
