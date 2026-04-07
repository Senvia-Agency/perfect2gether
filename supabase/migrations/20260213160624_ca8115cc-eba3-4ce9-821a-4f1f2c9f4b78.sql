
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
