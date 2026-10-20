-- Template automations are distinct from email_automations; retain both origins.
ALTER TABLE public.email_sends ADD COLUMN template_automation_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;
ALTER TABLE public.automation_queue ADD COLUMN template_automation_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;
ALTER TABLE public.automation_queue ALTER COLUMN automation_id DROP NOT NULL;
NOTIFY pgrst, 'reload schema';
