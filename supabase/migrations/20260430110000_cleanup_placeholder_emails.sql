-- Cleanup placeholder emails generated for prospects/leads without email.
-- Pattern: prospect-{uuid}@placeholder.local

-- Update prospects
UPDATE public.prospects
SET email = NULL
WHERE email LIKE '%@placeholder.local';

-- Update leads
UPDATE public.leads
SET email = ''
WHERE email LIKE '%@placeholder.local';

-- Update crm_clients
UPDATE public.crm_clients
SET email = NULL
WHERE email LIKE '%@placeholder.local';

-- Update marketing_contacts
UPDATE public.marketing_contacts
SET email = NULL
WHERE email LIKE '%@placeholder.local';
