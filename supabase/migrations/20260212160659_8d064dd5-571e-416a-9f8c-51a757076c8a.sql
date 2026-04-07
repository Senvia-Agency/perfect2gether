
-- Fix search_path on set_product_code trigger function
CREATE OR REPLACE FUNCTION public.set_product_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_product_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;
