CREATE OR REPLACE FUNCTION update_client_total_mwh()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_client_id := OLD.client_id;
  ELSE
    v_client_id := NEW.client_id;
  END IF;

  UPDATE crm_clients
  SET total_mwh = (
    SELECT COALESCE(SUM(consumo_anual), 0) / 1000.0
    FROM cpes
    WHERE client_id = v_client_id
      AND consumo_anual IS NOT NULL
  )
  WHERE id = v_client_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_client_total_mwh ON cpes;
CREATE TRIGGER trg_update_client_total_mwh
AFTER INSERT OR UPDATE OF consumo_anual OR DELETE ON cpes
FOR EACH ROW
EXECUTE FUNCTION update_client_total_mwh();

-- Recalculate all existing clients
UPDATE crm_clients c
SET total_mwh = (
  SELECT COALESCE(SUM(consumo_anual), 0) / 1000.0
  FROM cpes
  WHERE client_id = c.id
    AND consumo_anual IS NOT NULL
);
