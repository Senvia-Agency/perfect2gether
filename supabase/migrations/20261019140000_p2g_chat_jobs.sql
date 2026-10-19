-- Local migration only. Narrow durable outbox leases, never grant client access.
ALTER TABLE public.p2g_chat_push_jobs ADD COLUMN locked_until timestamptz, ADD COLUMN last_error text, ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.p2g_chat_file_cleanup ADD COLUMN locked_until timestamptz, ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX p2g_chat_push_due ON public.p2g_chat_push_jobs(next_attempt_at) WHERE delivered_at IS NULL;
CREATE OR REPLACE FUNCTION public.p2g_chat_take_work() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pushes jsonb; files jsonb;
BEGIN
 WITH picked AS (SELECT id FROM public.p2g_chat_push_jobs WHERE delivered_at IS NULL AND next_attempt_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 15),
 claimed AS (UPDATE public.p2g_chat_push_jobs j SET locked_until=now()+interval '10 minutes',attempts=attempts+1 FROM picked p WHERE p.id=j.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO pushes FROM claimed;
 WITH picked AS (SELECT path FROM public.p2g_chat_file_cleanup WHERE completed_at IS NULL AND next_attempt_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 30),
 claimed AS (UPDATE public.p2g_chat_file_cleanup j SET locked_until=now()+interval '10 minutes',attempts=attempts+1 FROM picked p WHERE p.path=j.path RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO files FROM claimed;
 RETURN jsonb_build_object('push',pushes,'cleanup',files);
END $$;
REVOKE ALL ON FUNCTION public.p2g_chat_take_work() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p2g_chat_take_work() TO service_role;
-- Existing automation secret in Vault; no new browser credentials, no message text in push payload.
DO $outer$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AND EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
   PERFORM cron.schedule('p2g-chat-jobs','* * * * *',$job$
    SELECT net.http_post(url:='https://zycrksvkdpondqpplqce.supabase.co/functions/v1/process-chat-jobs',
      headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx','Authorization','Bearer sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx',
      'x-p2g-automation-token',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='p2g_automation_token')),
      body:='{}'::jsonb,timeout_milliseconds:=10000);$job$);
 END IF;
END $outer$;

-- Wake the worker immediately after enqueue; the minute cron is only a retry safety net.
CREATE OR REPLACE FUNCTION p2g_chat_private.wake_worker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='p2g_automation_token';
  IF token IS NOT NULL THEN
   PERFORM net.http_post(url:='https://zycrksvkdpondqpplqce.supabase.co/functions/v1/process-chat-jobs',
    headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx','Authorization','Bearer sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx','x-p2g-automation-token',token),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
  END IF;
 END IF;
 RETURN NULL;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Chat worker wake failed; queued for retry'; RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION p2g_chat_private.wake_worker() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER chat_push_wake AFTER INSERT ON public.p2g_chat_push_jobs FOR EACH STATEMENT EXECUTE FUNCTION p2g_chat_private.wake_worker();
CREATE TRIGGER chat_cleanup_wake AFTER INSERT ON public.p2g_chat_file_cleanup FOR EACH STATEMENT EXECUTE FUNCTION p2g_chat_private.wake_worker();
