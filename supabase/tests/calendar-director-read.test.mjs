import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('director can read commercial meetings only; ownership and writes stay restricted', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select current_setting('app.actor')::uuid $$;
      create function public.get_user_org_id(uuid) returns uuid language sql stable as $$ select '${org}'::uuid $$;
      create function public.has_module_permission(uuid,text,text,text) returns boolean language sql stable as $$ select current_setting('app.permission') = 'true' $$;
      create table organization_profiles(id uuid, organization_id uuid, name text);
      create table organization_members(user_id uuid, organization_id uuid, profile_id uuid, is_active boolean);
      create table calendar_events(id int, organization_id uuid, user_id uuid, event_type text);
      alter table calendar_events enable row level security;
      grant usage on schema public,auth to authenticated;
      grant select on organization_profiles,organization_members to authenticated;
      grant select,update,delete on calendar_events to authenticated;
      create policy own_events on calendar_events for select to authenticated using(user_id=auth.uid() and organization_id=public.get_user_org_id(auth.uid()));
      insert into organization_profiles values
        ('${id(11)}','${org}','Diretor Comercial'), ('${id(12)}','${org}','Comercial'),
        ('${id(13)}','${org}','Back Office'), ('${id(14)}','${org}','CE');
      insert into organization_members values
        ('${id(1)}','${org}','${id(11)}',true), ('${id(2)}','${org}','${id(12)}',true),
        ('${id(3)}','${org}','${id(13)}',true), ('${id(4)}','${org}','${id(14)}',true),
        ('${id(5)}','${org}','${id(12)}',false);
      insert into calendar_events values
        (1,'${org}','${id(2)}','meeting'), (2,'${org}','${id(3)}','meeting'),
        (3,'${org}','${id(4)}','meeting'), (4,'${org}','${id(2)}','task'),
        (5,'${id(99)}','${id(2)}','meeting'), (6,'${org}','${id(5)}','meeting');
      select set_config('app.actor','${id(1)}',false), set_config('app.permission','true',false);
      set role authenticated;
    `);
    const visible = async () => (await db.query('select id from calendar_events order by id')).rows.map(row => row.id);
    assert.deepEqual(await visible(), [], 'old policy hides other commercial meetings from director');
    await db.exec('reset role');
    const migration = readdirSync('supabase/migrations').find(name => name.endsWith('_p2g_commercial_director_calendar_read.sql'));
    assert.ok(migration);
    await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
    await db.exec('set role authenticated');
    assert.deepEqual(await visible(), [1, 3], 'director sees all commercial meetings, without BO/tasks/other org/inactive');
    assert.deepEqual((await db.query('delete from calendar_events where id=1 returning id')).rows, []);
    assert.deepEqual((await db.query("update calendar_events set event_type='task' where id=1 returning id")).rows, []);
    await db.exec("select set_config('app.permission','false',false)");
    assert.deepEqual(await visible(), [], 'calendar permission still required');
    await db.exec(`select set_config('app.actor','${id(2)}',false), set_config('app.permission','true',false)`);
    assert.deepEqual(await visible(), [1,4], 'commercial ownership policy unchanged');
    await db.exec(`select set_config('app.actor','${id(3)}',false)`);
    assert.deepEqual(await visible(), [2], 'BO does not inherit director policy');
  } finally {
    await db.close();
  }
});

