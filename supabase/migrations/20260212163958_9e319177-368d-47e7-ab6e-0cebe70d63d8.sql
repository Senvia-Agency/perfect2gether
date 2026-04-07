
-- Update existing pending sales to in_progress
UPDATE public.sales SET status = 'in_progress' WHERE status = 'pending';

-- Change default value
ALTER TABLE public.sales ALTER COLUMN status SET DEFAULT 'in_progress';
