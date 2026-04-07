ALTER TABLE email_sends DROP CONSTRAINT email_sends_status_check;
ALTER TABLE email_sends ADD CONSTRAINT email_sends_status_check 
  CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'blocked', 'spam'));