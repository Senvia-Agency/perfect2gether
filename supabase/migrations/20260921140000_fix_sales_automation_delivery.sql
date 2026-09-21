-- Automacoes de venda: usar o projeto P2G atual e processar a fila pendente.
-- A chave anon e publica por definicao; e necessaria apenas para o gateway
-- validar a chamada interna do trigger/cron.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

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

  perform net.http_post(
    url := 'https://zycrksvkdpondqpplqce.supabase.co/functions/v1/process-automation',
    body := _payload,
    headers := jsonb_build_object(
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

drop trigger if exists trigger_automation_sales on public.sales;
create trigger trigger_automation_sales
  after insert or update on public.sales
  for each row execute function public.notify_automation_trigger();

drop trigger if exists trigger_automation_proposals on public.proposals;
create trigger trigger_automation_proposals
  after insert or update on public.proposals
  for each row execute function public.notify_automation_trigger();

-- Um nome de job fixo torna a migracao idempotente se for reaplicada.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'process-automation-queue-every-minute';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'process-automation-queue-every-minute',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://zycrksvkdpondqpplqce.supabase.co/functions/v1/process-automation-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx',
        'Authorization', 'Bearer sb_publishable_AQfkyMYBUEoUN27Z4_1siQ_nDs_5UGx'
      ),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 10000
    );
  $job$
);
