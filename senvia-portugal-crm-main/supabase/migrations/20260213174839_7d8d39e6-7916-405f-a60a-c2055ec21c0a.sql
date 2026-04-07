UPDATE email_sends
SET opened_at = NULL
WHERE opened_at IS NOT NULL
  AND sent_at IS NOT NULL
  AND EXTRACT(EPOCH FROM (opened_at - sent_at)) < 120;