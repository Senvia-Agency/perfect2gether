ALTER TABLE public.email_sends 
ADD COLUMN automation_id uuid REFERENCES public.email_automations(id) ON DELETE SET NULL;