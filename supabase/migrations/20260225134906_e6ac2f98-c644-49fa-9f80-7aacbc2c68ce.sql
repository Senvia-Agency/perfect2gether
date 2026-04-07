
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_code TEXT;

CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(ticket_code, 'SUP-', '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM support_tickets
  WHERE organization_id = NEW.organization_id
  AND ticket_code IS NOT NULL;
  
  NEW.ticket_code := 'SUP-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_ticket_code ON public.support_tickets;
CREATE TRIGGER set_ticket_code
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_code();
