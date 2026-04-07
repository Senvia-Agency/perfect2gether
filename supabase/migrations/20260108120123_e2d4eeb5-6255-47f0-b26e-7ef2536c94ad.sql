-- Add message template columns for each temperature level
ALTER TABLE public.organizations
ADD COLUMN msg_template_hot text,
ADD COLUMN msg_template_warm text,
ADD COLUMN msg_template_cold text;