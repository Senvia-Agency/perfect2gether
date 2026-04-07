-- Add temperature column to leads table
ALTER TABLE public.leads 
ADD COLUMN temperature text DEFAULT 'cold' 
CHECK (temperature IN ('cold', 'warm', 'hot'));