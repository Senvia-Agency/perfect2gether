BEGIN;
DO $outer$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AND EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
  PERFORM cron.schedule('p2g-clock-jobs','*/5 * * * *',$job$
   SELECT net.http_post(url:='https://zycrksvkdpondqpplqce.supabase.co/functions/v1/clock-notification-worker',
    headers:=jsonb_build_object('Content-Type','application/json','x-clock-worker-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='p2g_automation_token')),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
  $job$);
 END IF;
END $outer$;
COMMIT;
