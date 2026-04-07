-- Function to update client metrics when proposals change
CREATE OR REPLACE FUNCTION public.update_client_proposal_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.crm_clients 
    SET 
      total_proposals = COALESCE(total_proposals, 0) + 1,
      updated_at = now()
    WHERE id = NEW.client_id;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' AND OLD.client_id IS NOT NULL THEN
    UPDATE public.crm_clients 
    SET 
      total_proposals = GREATEST(COALESCE(total_proposals, 0) - 1, 0),
      updated_at = now()
    WHERE id = OLD.client_id;
    RETURN OLD;
  END IF;

  -- Handle UPDATE (client_id changed)
  IF TG_OP = 'UPDATE' THEN
    -- Decrement old client
    IF OLD.client_id IS NOT NULL AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      UPDATE public.crm_clients 
      SET 
        total_proposals = GREATEST(COALESCE(total_proposals, 0) - 1, 0),
        updated_at = now()
      WHERE id = OLD.client_id;
    END IF;
    
    -- Increment new client
    IF NEW.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      UPDATE public.crm_clients 
      SET 
        total_proposals = COALESCE(total_proposals, 0) + 1,
        updated_at = now()
      WHERE id = NEW.client_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for proposals
DROP TRIGGER IF EXISTS trigger_update_client_proposal_metrics ON public.proposals;
CREATE TRIGGER trigger_update_client_proposal_metrics
  AFTER INSERT OR UPDATE OR DELETE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_client_proposal_metrics();

-- Function to update client metrics when sales change
CREATE OR REPLACE FUNCTION public.update_client_sales_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.crm_clients 
    SET 
      total_sales = COALESCE(total_sales, 0) + 1,
      total_value = COALESCE(total_value, 0) + COALESCE(NEW.total_value, 0),
      updated_at = now()
    WHERE id = NEW.client_id;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' AND OLD.client_id IS NOT NULL THEN
    UPDATE public.crm_clients 
    SET 
      total_sales = GREATEST(COALESCE(total_sales, 0) - 1, 0),
      total_value = GREATEST(COALESCE(total_value, 0) - COALESCE(OLD.total_value, 0), 0),
      updated_at = now()
    WHERE id = OLD.client_id;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Value changed on same client
    IF OLD.client_id IS NOT NULL AND OLD.client_id = NEW.client_id THEN
      UPDATE public.crm_clients 
      SET 
        total_value = GREATEST(COALESCE(total_value, 0) - COALESCE(OLD.total_value, 0) + COALESCE(NEW.total_value, 0), 0),
        updated_at = now()
      WHERE id = NEW.client_id;
    ELSE
      -- Client changed - adjust both
      IF OLD.client_id IS NOT NULL THEN
        UPDATE public.crm_clients 
        SET 
          total_sales = GREATEST(COALESCE(total_sales, 0) - 1, 0),
          total_value = GREATEST(COALESCE(total_value, 0) - COALESCE(OLD.total_value, 0), 0),
          updated_at = now()
        WHERE id = OLD.client_id;
      END IF;
      
      IF NEW.client_id IS NOT NULL THEN
        UPDATE public.crm_clients 
        SET 
          total_sales = COALESCE(total_sales, 0) + 1,
          total_value = COALESCE(total_value, 0) + COALESCE(NEW.total_value, 0),
          updated_at = now()
        WHERE id = NEW.client_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for sales
DROP TRIGGER IF EXISTS trigger_update_client_sales_metrics ON public.sales;
CREATE TRIGGER trigger_update_client_sales_metrics
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_client_sales_metrics();