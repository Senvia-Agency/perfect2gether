
-- Add code column to products
ALTER TABLE public.products ADD COLUMN code TEXT;

-- Create function to generate product code (same pattern as clients/sales/proposals)
CREATE OR REPLACE FUNCTION public.generate_product_code(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO _count
  FROM products
  WHERE organization_id = _org_id AND code IS NOT NULL;
  RETURN LPAD(_count::TEXT, 4, '0');
END;
$$;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.set_product_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_product_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_product_code
BEFORE INSERT ON public.products
FOR EACH ROW
WHEN (NEW.code IS NULL)
EXECUTE FUNCTION public.set_product_code();

-- Unique index per organization
CREATE UNIQUE INDEX idx_products_org_code ON public.products (organization_id, code);

-- Backfill existing products
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT id, organization_id,
           ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) AS rn
    FROM products
    WHERE code IS NULL
  ) LOOP
    UPDATE products SET code = LPAD(r.rn::TEXT, 4, '0') WHERE id = r.id;
  END LOOP;
END;
$$;
