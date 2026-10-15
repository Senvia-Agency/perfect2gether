-- Keep one sales automation trigger for INSERT and status-changing UPDATE.
DROP TRIGGER IF EXISTS automation_sales_insert ON public.sales;
DROP TRIGGER IF EXISTS trigger_automation_sales ON public.sales;
CREATE TRIGGER trigger_automation_sales
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.notify_automation_trigger();

-- Older templates stored JSON text inside JSONB. Preserve the configured rule.
UPDATE public.email_templates
SET automation_trigger_config = (automation_trigger_config #>> '{}')::jsonb
WHERE organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9'
  AND jsonb_typeof(automation_trigger_config)='string';
