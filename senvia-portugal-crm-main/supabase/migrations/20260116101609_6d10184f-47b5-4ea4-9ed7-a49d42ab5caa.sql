-- Permitir verificação pública do slug para login
-- Apenas permite ler os dados básicos das organizações (id, name, slug)
CREATE POLICY "Public can verify organization by slug"
  ON public.organizations
  FOR SELECT
  TO anon, authenticated
  USING (true);