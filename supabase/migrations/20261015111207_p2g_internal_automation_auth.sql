create or replace function public.notify_automation_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _trigger_type text;
  _org_id uuid;
  _payload jsonb;
  _automation_token text;
  _publishable_key constant text := 'sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx';
begin
  if tg_table_name = 'leads' then
    _org_id := new.organization_id;
    if tg_op = 'INSERT' then _trigger_type := 'lead_created';
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then _trigger_type := 'lead_status_changed';
    else return new;
    end if;
  elsif tg_table_name = 'crm_clients' then
    _org_id := new.organization_id;
    if tg_op = 'INSERT' then _trigger_type := 'client_created';
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then _trigger_type := 'client_status_changed';
    else return new;
    end if;
  elsif tg_table_name = 'sales' then
    _org_id := new.organization_id;
    if tg_op = 'INSERT' then _trigger_type := 'sale_created';
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then _trigger_type := 'sale_status_changed';
    else return new;
    end if;
  elsif tg_table_name = 'proposals' then
    _org_id := new.organization_id;
    if tg_op = 'INSERT' then _trigger_type := 'proposal_created';
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then _trigger_type := 'proposal_status_changed';
    else return new;
    end if;
  else
    return new;
  end if;

  _payload := jsonb_build_object(
    'trigger_type', _trigger_type,
    'organization_id', _org_id,
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );

  select decrypted_secret into _automation_token
  from vault.decrypted_secrets where name = 'p2g_automation_token';

  perform net.http_post(
    url := 'https://zycrksvkdpondqpplqce.supabase.co/functions/v1/process-automation',
    body := _payload,
    headers := jsonb_build_object(
      'x-p2g-automation-token', _automation_token,
      'Content-Type', 'application/json',
      'apikey', _publishable_key,
      'Authorization', 'Bearer ' || _publishable_key
    ),
    timeout_milliseconds := 10000
  );

  return new;
exception when others then
  raise warning 'Automation trigger failed: %', sqlerrm;
  return new;
end;
$$;

select cron.schedule(
 'process-automation-queue-every-minute', '* * * * *',
 $job$select net.http_post(
  url := 'https://zycrksvkdpondqpplqce.supabase.co/functions/v1/process-automation-queue',
  headers := jsonb_build_object('Content-Type','application/json',
   'apikey','sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx',
   'Authorization','Bearer sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx',
   'x-p2g-automation-token',(select decrypted_secret from vault.decrypted_secrets where name='p2g_automation_token')),
  body := jsonb_build_object('source','cron'), timeout_milliseconds := 10000
 );$job$
);
