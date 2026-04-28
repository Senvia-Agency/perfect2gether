ALTER TABLE public.crm_clients
  ADD COLUMN IF NOT EXISTS distrito TEXT,
  ADD COLUMN IF NOT EXISTS conselho TEXT,
  ADD COLUMN IF NOT EXISTS grupo_economico TEXT;
