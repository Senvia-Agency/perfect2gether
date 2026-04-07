
-- 1) Fix check constraint to allow queued and unsubscribed statuses
ALTER TABLE public.email_sends DROP CONSTRAINT IF EXISTS email_sends_status_check;
ALTER TABLE public.email_sends ADD CONSTRAINT email_sends_status_check 
  CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'blocked', 'spam', 'unsubscribed'));

-- 2) Backfill campaign metrics from email_sends (source of truth)
UPDATE public.email_campaigns ec
SET 
  total_recipients = agg.total_recipients,
  sent_count = agg.sent_count,
  failed_count = agg.failed_count
FROM (
  SELECT 
    campaign_id,
    COUNT(DISTINCT recipient_email) AS total_recipients,
    COUNT(DISTINCT recipient_email) FILTER (WHERE status IN ('sent', 'delivered')) AS sent_count,
    COUNT(DISTINCT recipient_email) FILTER (WHERE status IN ('failed', 'bounced', 'blocked', 'spam')) AS failed_count
  FROM public.email_sends
  WHERE campaign_id IS NOT NULL
  GROUP BY campaign_id
) agg
WHERE ec.id = agg.campaign_id
  AND ec.status IN ('sent', 'sending', 'failed')
  AND agg.total_recipients > 0;
