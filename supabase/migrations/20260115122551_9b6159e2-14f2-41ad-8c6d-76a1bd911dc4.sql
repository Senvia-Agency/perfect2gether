-- Tornar lead_id nullable para permitir propostas sem lead associado
ALTER TABLE proposals ALTER COLUMN lead_id DROP NOT NULL;