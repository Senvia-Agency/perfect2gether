-- Add tipologia and consumo_anual columns to leads table for Telecom template
ALTER TABLE leads
ADD COLUMN tipologia text,
ADD COLUMN consumo_anual numeric;

COMMENT ON COLUMN leads.tipologia IS 'Tipo de serviço: ee, gas, servicos, ee_servicos';
COMMENT ON COLUMN leads.consumo_anual IS 'Consumo anual em kWh ou potência em kWp';