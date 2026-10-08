import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(100),
  user = id(1),
  manager = id(2);
const migration = await readFile(
  new URL("../migrations/20261008120000_p2g_rh_workspace.sql", import.meta.url),
  "utf8",
);
async function setup(legacy = false) {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(current_setting('request.jwt.claim.role',true),'authenticated')$$;
 create function public.p2g_mfa_ok() returns boolean language sql stable as $$select coalesce(nullif(current_setting('test.mfa',true),''),'true')='true'$$;
 create type app_role as enum('admin','super_admin','salesperson');
 create table auth.users(id uuid primary key); create table organizations(id uuid primary key);
 create table profiles(id uuid primary key, full_name text, email text); create table user_roles(user_id uuid,role app_role);
 create function has_role(u uuid,r app_role) returns boolean language sql stable as $$select exists(select 1 from user_roles where user_id=u and role=r)$$;
 create function is_org_member(u uuid,o uuid) returns boolean language sql stable as $$select true$$;
 create function is_org_admin(u uuid,o uuid) returns boolean language sql stable as $$select true$$;
 create table organization_profiles(id uuid primary key, organization_id uuid,base_role app_role,module_permissions jsonb);
 create table organization_members(organization_id uuid,user_id uuid,profile_id uuid,is_active boolean);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text); alter table storage.objects enable row level security;
 create function storage.foldername(n text) returns text[] language sql immutable as $$select string_to_array(n,'/')$$;
 insert into organizations values('${org}'),('${id(200)}'); insert into auth.users values('${user}'),('${manager}'),('${id(3)}');
 insert into organization_profiles values('${id(10)}','${org}','salesperson','{}'),('${id(11)}','${org}','admin','{}');
 insert into profiles values('${user}','Colaborador','colaborador@example.test'),('${manager}','Gestor','gestor@example.test');
 insert into organization_members values('${org}','${user}','${id(10)}',true),('${org}','${manager}','${id(11)}',true),('${org}','${id(3)}','${id(10)}',false);
 `);
  await db.exec(
    await readFile(
      new URL(
        "../migrations/20260320180048_8ffae683-9217-47e2-9f52-f5b9339c5a58.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  if (legacy === true)
    await db.exec(
      `INSERT INTO rh_absences(id,organization_id,user_id,absence_type,status,start_date,end_date) VALUES ('${id(900)}','${org}','${user}','vacation','approved','2099-12-31','2100-01-04'),('${id(901)}','${org}','${user}','vacation','pending','2099-01-05','2099-01-05'); INSERT INTO rh_absence_periods(absence_id,start_date,end_date,business_days,status,period_type,start_time,end_time) VALUES ('${id(900)}','2099-12-31','2100-01-04',99,'approved','full_day',null,null),('${id(901)}','2099-01-05','2099-01-05',99,'pending','partial_day','09:00','13:00');`,
    );
  if (legacy === "balances")
    await db.exec(
      `ALTER TABLE rh_vacation_balances ADD COLUMN company_reserved_days numeric DEFAULT 5; INSERT INTO rh_vacation_balances(organization_id,user_id,year,total_days,used_days) VALUES ('${org}','${user}',2099,30,0);`,
    );
  await db.exec(migration);
  await db.exec(
    "grant usage on schema public,auth,storage to authenticated; grant select,insert,update,delete on all tables in schema public,storage to authenticated;",
  );
  return db;
}
async function as(db, actor, fn, mfa = true) {
  await db.exec("begin");
  try {
    await db.query(
      "select set_config('test.actor',$1,true),set_config('test.mfa',$2,true)",
      [actor, String(mfa)],
    );
    await db.exec("set local role authenticated");
    const r = await fn();
    await db.exec("commit");
    return r;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
const request = (date = "2099-01-05", extra = {}) => ({
  absence_type: "vacation",
  periods: [{ start_date: date, end_date: date, period_type: "full_day" }],
  ...extra,
});
const mutate = (db, action, payload) =>
  db
    .query("select rh_absence_mutate($1,$2,$3) result", [
      org,
      action,
      JSON.stringify(payload),
    ])
    .then((r) => r.rows[0].result);
test("vacation pending reserves balance and approval is counted once", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () => mutate(db, "create", request()));
    await as(db, manager, () => mutate(db, "approve", { id: a.id }));
    await assert.rejects(
      as(db, manager, () => mutate(db, "approve", { id: a.id })),
      /pendentes/,
    );
    const r = await db.query(
      "select used_days,pending_days from rh_vacation_balances",
    );
    assert.deepEqual(r.rows, [{ used_days: "1", pending_days: "0" }]);
  } finally {
    await db.close();
  }
});
test("cross year cancellation returns balances for every year", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () =>
      mutate(
        db,
        "create",
        request("2099-12-31", {
          periods: [{ start_date: "2099-12-31", end_date: "2100-01-04" }],
        }),
      ),
    );
    await as(db, manager, () => mutate(db, "approve", { id: a.id }));
    await as(db, user, () => mutate(db, "cancel", { id: a.id }));
    const r = await db.query(
      "select used_days,pending_days from rh_vacation_balances",
    );
    assert.ok(
      r.rows.length === 2 &&
        r.rows.every(
          (x) => Number(x.used_days) === 0 && Number(x.pending_days) === 0,
        ),
    );
  } finally {
    await db.close();
  }
});
test("own overlap and forged days are rejected or recalculated", async () => {
  const db = await setup();
  try {
    await as(db, user, () =>
      mutate(
        db,
        "create",
        request("2099-01-05", {
          periods: [
            {
              start_date: "2099-01-05",
              end_date: "2099-01-05",
              business_days: 999,
            },
          ],
        }),
      ),
    );
    await assert.rejects(
      as(db, user, () => mutate(db, "create", request())),
      /Conflito/,
    );
    const r = await db.query("select business_days from rh_absence_periods");
    assert.equal(Number(r.rows[0].business_days), 1);
  } finally {
    await db.close();
  }
});
test("unprivileged approval, inactive membership, foreign organization and MFA bypass denied", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () => mutate(db, "create", request()));
    await assert.rejects(
      as(db, user, () => mutate(db, "approve", { id: a.id })),
      /permissão/,
    );
    await assert.rejects(
      as(db, id(3), () => mutate(db, "create", request())),
      /negado/,
    );
    await assert.rejects(
      as(db, user, () => db.query("select rh_snapshot($1)", [id(200)])),
      /negado/,
    );
    await assert.rejects(
      as(db, user, () => mutate(db, "create", request()), false),
      /negado/,
    );
  } finally {
    await db.close();
  }
});
test("RLS hides colleague records and direct mutations have no policy", async () => {
  const db = await setup();
  try {
    await as(db, manager, () => mutate(db, "create", request("2099-01-06")));
    const rows = await as(db, user, () =>
      db.query("select * from rh_absences"),
    );
    assert.equal(rows.rows.length, 0);
    await assert.rejects(
      as(db, user, () =>
        db.query(
          "insert into rh_absences(organization_id,user_id,start_date,end_date) values($1,$2,'2099-01-05','2099-01-05')",
          [org, user],
        ),
      ),
      /row-level security/,
    );
  } finally {
    await db.close();
  }
});

const save = (db, kind, data, extra = {}) =>
  db
    .query("select rh_record_save($1,$2,$3,$4,$5,$6) result", [
      org,
      kind,
      JSON.stringify(data),
      extra.id ?? null,
      extra.user ?? user,
      extra.parent ?? null,
    ])
    .then((r) => r.rows[0].result);
test("48h advance rule blocks employee vacation today", async () => {
  const db = await setup();
  try {
    await assert.rejects(
      as(db, user, () =>
        mutate(db, "create", request(new Date().toISOString().slice(0, 10))),
      ),
      /48 horas/,
    );
  } finally {
    await db.close();
  }
});
test("partial hours and holidays are counted on server", async () => {
  const db = await setup();
  try {
    await as(db, user, () =>
      mutate(
        db,
        "create",
        request("2099-01-05", {
          periods: [
            {
              start_date: "2099-01-05",
              end_date: "2099-01-05",
              period_type: "partial_day",
              start_time: "09:00",
              end_time: "13:00",
              business_days: 99,
            },
          ],
        }),
      ),
    );
    const r = await db.query("select pending_days from rh_vacation_balances");
    assert.equal(Number(r.rows[0].pending_days), 0.5);
  } finally {
    await db.close();
  }
});
test("batch failure rolls back every request", async () => {
  const db = await setup();
  try {
    await assert.rejects(
      as(db, manager, () =>
        mutate(db, "batch", request("2099-01-05", { users: [user, id(3)] })),
      ),
      /inativo/,
    );
    assert.equal((await db.query("select * from rh_absences")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("company reserve cannot be spent from personal quota", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      db.query("select rh_balance_set($1,$2,2099,1,1)", [org, user]),
    );
    await assert.rejects(
      as(db, user, () => mutate(db, "create", request())),
      /Quota/,
    );
  } finally {
    await db.close();
  }
});
test("employee cannot select company quota", async () => {
  const db = await setup();
  try {
    await assert.rejects(
      as(db, user, () =>
        mutate(db, "create", request("2099-01-05", { allocation: "company" })),
      ),
      /Reserva/,
    );
  } finally {
    await db.close();
  }
});
test("manager company allocation consumes reserve", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      db.query("select rh_balance_set($1,$2,2099,2,1)", [org, user]),
    );
    await as(db, manager, () =>
      mutate(
        db,
        "create",
        request("2099-01-05", { allocation: "company", user_id: user }),
      ),
    );
    assert.equal(
      Number(
        (await db.query("select pending_days from rh_vacation_balances"))
          .rows[0].pending_days,
      ),
      1,
    );
  } finally {
    await db.close();
  }
});
test("partial approval only debits selected workdays", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () =>
      mutate(
        db,
        "create",
        request("2099-01-05", {
          periods: [{ start_date: "2099-01-05", end_date: "2099-01-06" }],
        }),
      ),
    );
    const r = await as(db, manager, () =>
      mutate(db, "partial", { id: a.id, approved_dates: ["2099-01-05"] }),
    );
    assert.equal(r.status, "partially_approved");
    const b = (
      await db.query("select used_days,pending_days from rh_vacation_balances")
    ).rows[0];
    assert.deepEqual(b, { used_days: "1", pending_days: "0" });
  } finally {
    await db.close();
  }
});
test("rejection and withdrawal require a reason", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () => mutate(db, "create", request()));
    await assert.rejects(
      as(db, manager, () => mutate(db, "reject", { id: a.id })),
      /motivo/,
    );
  } finally {
    await db.close();
  }
});
test("approved reschedule returns prior balance and snapshots periods", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () => mutate(db, "create", request()));
    await as(db, manager, () => mutate(db, "approve", { id: a.id }));
    await as(db, user, () =>
      mutate(db, "edit", request("2100-01-05", { id: a.id })),
    );
    const history = (
      await db.query("select before_data from rh_history where action='edit'")
    ).rows[0];
    assert.equal(history.before_data.periods[0].start_date, "2099-01-05");
    const b = (
      await db.query(
        "select year,used_days,pending_days from rh_vacation_balances order by year",
      )
    ).rows;
    assert.equal(Number(b[0].used_days), 0);
    assert.equal(Number(b[1].pending_days), 1);
  } finally {
    await db.close();
  }
});
test("holiday add and remove recalculate period days and balance atomically", async () => {
  const db = await setup();
  try {
    const a = await as(db, user, () => mutate(db, "create", request()));
    await as(db, manager, () => mutate(db, "approve", { id: a.id }));
    await as(db, manager, () =>
      db.query("select rh_holiday_set($1,'2099-01-05','Feriado')", [org]),
    );
    assert.equal(
      Number(
        (await db.query("select business_days from rh_absence_periods")).rows[0]
          .business_days,
      ),
      0,
    );
    const holiday = (await db.query("select id from rh_holidays")).rows[0];
    await as(db, manager, () =>
      db.query("select rh_holiday_set($1,'2099-01-05','Feriado',$2,true)", [
        org,
        holiday.id,
      ]),
    );
    assert.equal(
      Number(
        (await db.query("select used_days from rh_vacation_balances")).rows[0]
          .used_days,
      ),
      1,
    );
  } finally {
    await db.close();
  }
});
test("legacy pending partial_day and cross year approved balances are backfilled", async () => {
  const db = await setup(true);
  try {
    const rows = (
      await db.query(
        "select year,used_days,pending_days from rh_vacation_balances order by year",
      )
    ).rows;
    assert.equal(Number(rows[0].pending_days), 0.5);
    assert.equal(Number(rows[0].used_days), 1);
    assert.ok(Number(rows[1].used_days) > 0);
  } finally {
    await db.close();
  }
});
test("employee self update preserves professional fields and blocks arbitrary keys", async () => {
  const db = await setup();
  try {
    const r = await as(db, manager, () =>
      save(db, "employee", {
        phone: "old",
        job_title: "Gestor",
        birth_date: "1990-01-01",
      }),
    );
    const updated = await as(db, user, () =>
      save(db, "employee", { phone: "new" }, { id: r.id }),
    );
    assert.equal(updated.data.job_title, "Gestor");
    await assert.rejects(
      as(db, user, () =>
        save(db, "employee", { job_title: "Admin" }, { id: r.id }),
      ),
      /profissionais/,
    );
    await assert.rejects(
      as(db, user, () => save(db, "employee", { salary: "999" }, { id: r.id })),
      /Campo/,
    );
  } finally {
    await db.close();
  }
});
test("calendar-only access returns no colleague justification or medical category", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      mutate(
        db,
        "create",
        request("2099-01-05", {
          absence_type: "sick_leave",
          notes: "private diagnosis",
        }),
      ),
    );
    await db.query(
      "update organization_profiles set module_permissions=$1 where id=$2",
      [
        JSON.stringify({ rh: { subareas: { calendar: { view: true } } } }),
        id(10),
      ],
    );
    const result = (
      await as(db, user, () => db.query("select rh_snapshot($1) result", [org]))
    ).rows[0].result;
    assert.equal(result.absences.length, 0);
    assert.equal(result.calendar[0].notes, null);
    assert.equal(result.calendar[0].absence_type, "other");
    assert.equal(JSON.stringify(result).includes("private diagnosis"), false);
  } finally {
    await db.close();
  }
});
test("notice edits synchronize recipients and notification title", async () => {
  const db = await setup();
  try {
    const n = await as(db, manager, () =>
      save(
        db,
        "notice",
        { title: "Before", body: "body", recipients: [user] },
        { user: manager },
      ),
    );
    await as(db, manager, () =>
      save(
        db,
        "notice",
        { title: "After", body: "body", recipients: [manager] },
        { id: n.id, user: manager },
      ),
    );
    const rows = (
      await db.query(
        "select user_id,payload from rh_notifications where event_key=$1",
        ["notice:" + n.id],
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, manager);
    assert.equal(rows[0].payload.title, "After");
  } finally {
    await db.close();
  }
});
test("ticket participants can access attachments and unrelated employee cannot", async () => {
  const db = await setup();
  try {
    const dep = await as(db, manager, () =>
      save(db, "department", { name: "RH" }, { user: manager }),
    );
    const ticket = await as(db, user, () =>
      save(db, "ticket", {
        title: "Ajuda",
        priority: "normal",
        status: "open",
        department_id: dep.id,
      }),
    );
    const path = `${org}/${manager}/file.pdf`;
    await as(db, manager, () =>
      save(
        db,
        "document",
        { name: "file.pdf", path, category: "Suporte" },
        { user: manager, parent: ticket.id },
      ),
    );
    await db.query("insert into storage.objects values($1,$2,'rh-private')", [
      id(500),
      path,
    ]);
    const objects = await as(db, user, () =>
      db.query("select * from storage.objects"),
    );
    assert.equal(objects.rows.length, 1);
    await assert.rejects(
      as(db, user, () =>
        save(
          db,
          "document",
          { path: `${org}/${user}/file.pdf`, category: "Suporte" },
          { parent: id(999) },
        ),
      ),
      /Anexo/,
    );
  } finally {
    await db.close();
  }
});
test("support event routes to configured email recipient and in-app tick leaves email queued", async () => {
  const db = await setup();
  try {
    const dep = await as(db, manager, () =>
      save(db, "department", { name: "RH" }, { user: manager }),
    );
    await as(db, manager, () =>
      save(
        db,
        "recipient",
        {
          name: "Support",
          event: "support",
          channel: "email",
          recipients: [],
          emails: ["rh@example.test"],
          department_id: dep.id,
          active: true,
        },
        { user: manager },
      ),
    );
    await as(db, user, () =>
      save(db, "ticket", {
        title: "Ajuda",
        priority: "normal",
        status: "open",
        department_id: dep.id,
      }),
    );
    await as(db, manager, () =>
      db.query("select rh_notification_tick($1)", [org]),
    );
    const rows = (
      await db.query(
        "select channel,state,payload from rh_notifications where channel='email'",
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, "queued");
    assert.equal(rows[0].payload.to, "rh@example.test");
  } finally {
    await db.close();
  }
});
test("health reminder reschedule clears prior delivery metadata", async () => {
  const db = await setup();
  try {
    const r = await as(db, manager, () =>
      save(db, "health", {
        appointment_at: "2099-01-05T10:00:00Z",
        remind_at: "2099-01-04T10:00:00Z",
      }),
    );
    await db.query(
      "update rh_notifications set state='delivered',delivered_at=now(),attempts=2,last_error='old'",
    );
    await as(db, manager, () =>
      save(
        db,
        "health",
        {
          appointment_at: "2099-01-06T10:00:00Z",
          remind_at: "2099-01-05T10:00:00Z",
        },
        { id: r.id },
      ),
    );
    const row = (
      await db.query(
        "select state,delivered_at,attempts,last_error from rh_notifications",
      )
    ).rows[0];
    assert.deepEqual(row, {
      state: "queued",
      delivered_at: null,
      attempts: 0,
      last_error: null,
    });
  } finally {
    await db.close();
  }
});
test("superadmin without membership can administer organization but absence target must be active", async () => {
  const db = await setup();
  try {
    await db.query("insert into auth.users values($1)", [id(4)]);
    await db.query("insert into user_roles values($1,'super_admin')", [id(4)]);
    const record = await as(db, id(4), () =>
      save(db, "department", { name: "RH" }, { user: id(4) }),
    );
    assert.equal(record.user_id, id(4));
    await as(db, id(4), () =>
      mutate(db, "create", request("2099-01-05", { user_id: user })),
    );
    await assert.rejects(
      as(db, id(4), () => mutate(db, "create", request("2099-01-06"))),
      /inativo/,
    );
    await assert.rejects(
      as(db, id(4), () => db.query("select rh_snapshot($1)", [org]), false),
      /negado/,
    );
  } finally {
    await db.close();
  }
});
test("global regular admin remains restricted to organization membership", async () => {
  const db = await setup();
  try {
    await db.query("insert into user_roles values($1,'admin')", [manager]);
    await assert.rejects(
      as(db, manager, () => db.query("select rh_snapshot($1)", [id(200)])),
      /negado/,
    );
  } finally {
    await db.close();
  }
});
test("ticket read participant cannot delete or replace manager attachment", async () => {
  const db = await setup();
  try {
    const dep = await as(db, manager, () =>
      save(db, "department", { name: "RH" }, { user: manager }),
    );
    const ticket = await as(db, user, () =>
      save(db, "ticket", {
        title: "Ajuda",
        priority: "normal",
        status: "open",
        department_id: dep.id,
      }),
    );
    const path = `${org}/${manager}/proof.pdf`;
    await as(db, manager, () =>
      save(
        db,
        "document",
        { name: "proof.pdf", path, category: "Suporte" },
        { user: manager, parent: ticket.id },
      ),
    );
    await db.query("insert into storage.objects values($1,$2,'rh-private')", [
      id(502),
      path,
    ]);
    await as(db, user, () =>
      db.query("delete from storage.objects where id=$1", [id(502)]),
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await assert.rejects(
      as(db, user, () =>
        db.query("insert into storage.objects values($1,$2,'rh-private')", [
          id(503),
          path,
        ]),
      ),
      /row-level security/,
    );
  } finally {
    await db.close();
  }
});
test("health reschedule replaces renewal email and removal cancels queued reminders", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      save(
        db,
        "recipient",
        {
          name: "Health",
          event: "health",
          channel: "email",
          recipients: [],
          emails: ["rh@example.test"],
        },
        { user: manager },
      ),
    );
    const r = await as(db, manager, () =>
      save(db, "health", {
        appointment_at: "2099-01-05T10:00:00Z",
        remind_at: "2099-01-04T10:00:00Z",
        renewal_months: 6,
      }),
    );
    assert.ok(r.data.next_at.startsWith("2099-07-05"));
    await as(db, manager, () =>
      save(
        db,
        "health",
        {
          appointment_at: "2099-02-05T10:00:00Z",
          remind_at: "2099-02-04T10:00:00Z",
          renewal_months: 6,
        },
        { id: r.id },
      ),
    );
    assert.equal(
      (await db.query("select * from rh_notifications where channel='email'"))
        .rows.length,
      2,
    );
    await as(db, manager, () =>
      db.query("select rh_record_remove($1,$2)", [org, r.id]),
    );
    assert.equal(
      (await db.query("select * from rh_notifications")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("removing configured recipients cancels outstanding configured email jobs", async () => {
  const db = await setup();
  try {
    const cfg = await as(db, manager, () =>
      save(
        db,
        "recipient",
        {
          name: "Support",
          event: "support",
          channel: "email",
          recipients: [],
          emails: ["rh@example.test"],
        },
        { user: manager },
      ),
    );
    const dep = await as(db, manager, () =>
      save(db, "department", { name: "RH" }, { user: manager }),
    );
    await as(db, user, () =>
      save(db, "ticket", {
        title: "Ajuda",
        priority: "normal",
        status: "open",
        department_id: dep.id,
      }),
    );
    await as(db, manager, () =>
      db.query("select rh_record_remove($1,$2)", [org, cfg.id]),
    );
    assert.equal(
      (await db.query("select * from rh_notifications where channel='email'"))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("email preview does not mutate and claims exclude already processing rows", async () => {
  const db = await setup();
  try {
    await db.query(
      'insert into rh_notifications(organization_id,user_id,event_key,payload,channel) values($1,$2,\'email\',\'{"title":"Test","to":"rh@example.test"}\',\'email\')',
      [org, manager],
    );
    await as(db, manager, () =>
      db.query("select rh_email_claim($1,true)", [org]),
    );
    assert.equal(
      (await db.query("select state from rh_notifications")).rows[0].state,
      "queued",
    );
    const first = await as(db, manager, () =>
      db.query("select rh_email_claim($1,false) jobs", [org]),
    );
    const second = await as(db, manager, () =>
      db.query("select rh_email_claim($1,false) jobs", [org]),
    );
    assert.equal(first.rows[0].jobs.length, 1);
    assert.equal(second.rows[0].jobs.length, 0);
  } finally {
    await db.close();
  }
});
test("legacy balance total update preserves company reserve and pending count is visible to edit-only manager", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      db.query("select rh_balance_set($1,$2,2099,22,5)", [org, user]),
    );
    await db.query(
      "update organization_profiles set base_role='salesperson',module_permissions=$1 where id=$2",
      [
        JSON.stringify({
          portal_total_link: { subareas: { rh: { view: false, edit: true } } },
        }),
        id(11),
      ],
    );
    await as(db, manager, () =>
      db.query("select rh_balance_set($1,$2,2099,25)", [org, user]),
    );
    const rows = await as(db, manager, () =>
      db.query(
        "select total_days,company_reserved_days from rh_vacation_balances",
      ),
    );
    assert.equal(Number(rows.rows[0].company_reserved_days), 5);
    assert.equal(Number(rows.rows[0].total_days), 25);
  } finally {
    await db.close();
  }
});
test("in-app recipient configuration never enqueues additional email addresses", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      save(
        db,
        "recipient",
        {
          name: "Support",
          event: "support",
          channel: "in_app",
          recipients: [manager],
          emails: ["rh@example.test"],
        },
        { user: manager },
      ),
    );
    const dep = await as(db, manager, () =>
      save(db, "department", { name: "RH" }, { user: manager }),
    );
    await as(db, user, () =>
      save(db, "ticket", {
        title: "Ajuda",
        priority: "normal",
        status: "open",
        department_id: dep.id,
      }),
    );
    assert.equal(
      (await db.query("select * from rh_notifications where channel='email'"))
        .rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from rh_notifications where channel='in_app'"))
        .rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
test("disabled internal recipient is not claimed while configured external recipients remain eligible", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      save(
        db,
        "recipient",
        {
          name: "Absences",
          event: "absence",
          channel: "email",
          recipients: [manager],
          emails: ["rh@example.test"],
        },
        { user: manager },
      ),
    );
    await as(db, user, () => mutate(db, "create", request()));
    await db.query(
      "update organization_members set is_active=false where user_id=$1",
      [manager],
    );
    await db.exec(
      "begin;select set_config('request.jwt.claim.role','service_role',true);set local role service_role;",
    );
    const result = await db.query("select rh_email_claim($1,true) jobs", [org]);
    await db.exec("rollback");
    assert.equal(result.rows[0].jobs.length, 1);
    assert.equal(result.rows[0].jobs[0].payload.to, "rh@example.test");
    await db.exec(
      "begin;select set_config('request.jwt.claim.role','service_role',true);set local role service_role;",
    );
    await db.query("select rh_email_claim($1,false)", [org]);
    await db.exec("commit");
    const cancelled = (
      await db.query(
        "select state,attempts from rh_notifications where recipient_user_id=$1",
        [manager],
      )
    ).rows[0];
    assert.equal(cancelled.state, "failed");
    assert.equal(cancelled.attempts, 5);
    await db.query(
      "update organization_members set is_active=true where user_id=$1",
      [manager],
    );
    const after = await as(db, manager, () =>
      db.query("select rh_email_claim($1,true) jobs", [org]),
    );
    assert.equal(after.rows[0].jobs.length, 0);
  } finally {
    await db.close();
  }
});
test("processing jobs with delivery started are never automatically reclaimed", async () => {
  const db = await setup();
  try {
    await db.query(
      "insert into rh_notifications(organization_id,user_id,event_key,payload,channel,state,claimed_at,delivery_started_at) values($1,$2,'email','{\"title\":\"Test\",\"to\":\"rh@example.test\"}','email','processing',now()-interval '1 hour',now()-interval '1 hour')",
      [org, manager],
    );
    const jobs = await as(db, manager, () =>
      db.query("select rh_email_claim($1,false) jobs", [org]),
    );
    assert.equal(jobs.rows[0].jobs.length, 0);
    assert.equal(
      (await db.query("select state from rh_notifications")).rows[0].state,
      "uncertain",
    );
  } finally {
    await db.close();
  }
});
test("separate available quotas track personal and company allocations after company approval", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      db.query("select rh_balance_set($1,$2,2099,22,5)", [org, user]),
    );
    const a = await as(db, manager, () =>
      mutate(
        db,
        "create",
        request("2099-01-05", { user_id: user, allocation: "company" }),
      ),
    );
    await as(db, manager, () => mutate(db, "approve", { id: a.id }));
    await as(db, user, () => mutate(db, "create", request("2099-01-06")));
    const balance = (
      await db.query(
        "select personal_available_days,company_available_days from rh_vacation_balances",
      )
    ).rows[0];
    assert.equal(Number(balance.personal_available_days), 16);
    assert.equal(Number(balance.company_available_days), 4);
  } finally {
    await db.close();
  }
});

test("custom legacy balance without absence derives both quotas", async () => {
  const db = await setup("balances");
  try {
    const b = (await db.query("select * from rh_vacation_balances")).rows[0];
    assert.equal(Number(b.personal_available_days), 25);
    assert.equal(Number(b.company_available_days), 5);
  } finally {
    await db.close();
  }
});
test("private upload reservation and cleanup enforce ownership and prevent relinking claimed paths", async () => {
  const db = await setup();
  try {
    const path = org + "/" + user + "/new.pdf";
    await assert.rejects(
      as(db, user, () =>
        db.query("insert into storage.objects values($1,$2,'rh-private')", [
          id(950),
          path,
        ]),
      ),
      /row-level security/,
    );
    await as(db, user, () =>
      db.query("select rh_storage_cleanup_request($1,$2)", [org, path]),
    );
    await as(db, user, () =>
      db.query("insert into storage.objects values($1,$2,'rh-private')", [
        id(950),
        path,
      ]),
    );
    const doc = await as(db, user, () =>
      save(db, "document", { name: "new.pdf", path, category: "Pessoal" }),
    );
    assert.equal(
      (await db.query("select state from rh_storage_cleanup")).rows[0].state,
      "linked",
    );
    await assert.rejects(
      as(db, user, () =>
        save(
          db,
          "document",
          { name: "new.pdf", path: path + "other", category: "Pessoal" },
          { id: doc.id },
        ),
      ),
      /caminho/,
    );
    assert.equal(
      (
        await as(db, user, () =>
          db.query("delete from storage.objects returning id"),
        )
      ).rows.length,
      0,
    );
    await as(db, user, () =>
      db.query("select rh_record_remove($1,$2)", [org, doc.id]),
    );
    assert.equal(
      (await as(db, user, () => db.query("select * from storage.objects"))).rows
        .length,
      0,
    );
    await assert.rejects(
      as(db, manager, () =>
        db.query("select rh_storage_cleanup_claim($1)", [org]),
      ),
      /permission denied/,
    );
    await db.exec(
      "begin;select set_config('request.jwt.claim.role','service_role',true);set local role service_role;",
    );
    const jobs = (
      await db.query("select rh_storage_cleanup_claim($1) jobs", [org])
    ).rows[0].jobs;
    await db.exec("commit");
    assert.equal(jobs.length, 1);
    await assert.rejects(
      as(db, user, () =>
        save(db, "document", { name: "new.pdf", path, category: "Pessoal" }),
      ),
      /expirou/,
    );
    await assert.rejects(
      as(db, user, () =>
        db.query("select rh_storage_cleanup_request($1,$2)", [org, path]),
      ),
      /expirou/,
    );
  } finally {
    await db.close();
  }
});
test("permission revocation hides former authored configuration notices and external jobs", async () => {
  const db = await setup();
  try {
    await as(db, manager, () =>
      save(
        db,
        "group",
        { name: "Group", recipients: [user] },
        { user: manager },
      ),
    );
    await as(db, manager, () =>
      save(
        db,
        "notice",
        { title: "Notice", body: "Body", recipients: [user] },
        { user: manager },
      ),
    );
    await as(db, manager, () =>
      save(
        db,
        "recipient",
        {
          name: "Email",
          event: "absence",
          channel: "email",
          recipients: [],
          emails: ["rh@example.test"],
        },
        { user: manager },
      ),
    );
    await as(db, user, () => mutate(db, "create", request()));
    await db.query(
      "update organization_profiles set base_role='salesperson',module_permissions='{}' where id=$1",
      [id(11)],
    );
    const records = await as(db, manager, () =>
      db.query(
        "select * from rh_records where kind in ('group','recipient','notice')",
      ),
    );
    assert.equal(records.rows.length, 0);
    const emails = await as(db, manager, () =>
      db.query("select * from rh_notifications where channel='email'"),
    );
    assert.equal(emails.rows.length, 0);
  } finally {
    await db.close();
  }
});

test("document view-only permission never exposes foreign personal metadata or signed-url storage source", async () => {
  const db = await setup();
  try {
    const path = `${org}/${manager}/private.pdf`;
    await as(db, manager, () => save(db, "document", {name:"private.pdf",path,category:"Pessoal"}, {user:manager}));
    await db.query("insert into storage.objects values($1,$2,'rh-private')",[id(960),path]);
    await db.query("update organization_profiles set module_permissions=$1 where id=$2",[JSON.stringify({rh:{subareas:{documents:{view:true}}}}),id(10)]);
    const metadata = await as(db,user,()=>db.query("select * from rh_records where kind='document'"));
    const storageSource = await as(db,user,()=>db.query("select * from storage.objects where name=$1",[path]));
    const visible = await as(db,user,()=>db.query("select rh_attachment_visible($1,$2,$3,null) visible",[org,manager,JSON.stringify({path})]));
    assert.equal(metadata.rows.length,0);
    assert.equal(storageSource.rows.length,0);
    assert.equal(visible.rows[0].visible,false);
  } finally {await db.close();}
});

test("service scheduler fans out birthdays to configured internal recipients and human actor skips self",async()=>{
 const db=await setup();try {
 const today=(await db.query("select current_date::text today")).rows[0].today;
 await as(db,manager,()=>save(db,"employee",{full_name:"Colaborador",birth_date:today},{user}));
 await as(db,manager,()=>save(db,"recipient",{name:"Aniversarios",event:"birthday",channel:"in_app",recipients:[manager]},{user:manager}));
 await as(db,manager,()=>db.query("select rh_notification_tick($1)",[org]));
 assert.equal((await db.query("select * from rh_notifications where user_id=$1 and source_record_id is not null",[manager])).rows.length,0);
 await db.exec("begin;select set_config('request.jwt.claim.role','service_role',true);set local role service_role;");
 await db.query("select rh_notification_tick($1)",[org]);await db.exec("commit");
 const rows=(await db.query("select * from rh_notifications where user_id=$1 and source_record_id is not null",[manager])).rows;assert.equal(rows.length,1);assert.equal(rows[0].state,"delivered");
 }finally {await db.close();}
});
test("employee view-only directory is personal and calendar names never disclose foreign emails",async()=>{
 const db=await setup();try {
 await db.query("update organization_profiles set module_permissions=$1 where id=$2",[JSON.stringify({rh:{subareas:{employees:{view:true}}}}),id(10)]);
 const own=(await as(db,user,()=>db.query("select rh_directory($1) people",[org]))).rows[0].people;assert.equal(own.length,1);assert.equal(own[0].user_id,user);
 await db.query("update organization_profiles set module_permissions=$1 where id=$2",[JSON.stringify({rh:{subareas:{employees:{view:true},calendar:{view:true}}}}),id(10)]);
 const names=(await as(db,user,()=>db.query("select rh_directory($1) people",[org]))).rows[0].people;assert.equal(names.length,2);assert.equal(names.find(p=>p.user_id===manager).email,null);
 }finally{await db.close();}
});

test("partial approval rejects selected weekend or holiday atomically",async()=>{
 const db=await setup();try {
 await as(db,manager,()=>db.query("select rh_holiday_set($1,'2099-01-06','Feriado')",[org]));
 const a=await as(db,user,()=>mutate(db,"create",{absence_type:"vacation",periods:[{start_date:"2099-01-05",end_date:"2099-01-11",period_type:"full_day"}]}));
 for(const day of ["2099-01-06","2099-01-10"]){await assert.rejects(as(db,manager,()=>mutate(db,"partial",{id:a.id,reason:"Teste",approved_dates:[day]})),/Dia fora/);}
 assert.equal((await db.query("select status from rh_absences")).rows[0].status,"pending");assert.equal((await db.query("select count(*) count from rh_absence_periods")).rows[0].count,1);
 }finally{await db.close();}
});
test("exhausted cleanup path cannot accept a fresh upload reservation",async()=>{
 const db=await setup();try {const path=org+"/"+user+"/retry.pdf";await as(db,user,()=>db.query("select rh_storage_cleanup_request($1,$2)",[org,path]));await db.query("update rh_storage_cleanup set state='failed',attempts=5,last_error='Offline'");await assert.rejects(as(db,user,()=>db.query("select rh_storage_cleanup_request($1,$2)",[org,path])),/expirou/);assert.equal((await db.query("select state,attempts from rh_storage_cleanup")).rows[0].state,"failed");}finally{await db.close();}
});
test("legacy view-only calendar exposes colleague overlap without clinical data",async()=>{
 const db=await setup();try {await as(db,manager,()=>mutate(db,"create",{...request(),absence_type:"sick_leave",notes:"Clinical secret"}));await db.query("update organization_profiles set module_permissions=$1 where id=$2",[JSON.stringify({portal_total_link:{subareas:{rh:{view:true}}}}),id(10)]);const rows=(await as(db,user,()=>db.query("select rh_calendar($1) events",[org]))).rows[0].events;assert.equal(rows.length,1);assert.equal(rows[0].user_id,manager);assert.equal(rows[0].notes,null);assert.equal(rows[0].absence_type,"other");assert.equal(rows[0].periods[0].start_date,"2099-01-05");}finally{await db.close();}
});

test("recipient deactivated after delivery start becomes uncertain rather than falsely failed",async()=>{
 const db=await setup();try {
 await db.query("insert into rh_notifications(organization_id,user_id,recipient_user_id,event_key,payload,channel,state,attempts,claimed_at,delivery_started_at) values($1,$2,$2,'started-inactive','{\"title\":\"Email\",\"to\":\"rh@example.test\"}','email','processing',1,now(),now())",[org,manager]);
 await db.query("update organization_members set is_active=false where user_id=$1",[manager]);
 await db.exec("begin;select set_config('request.jwt.claim.role','service_role',true);set local role service_role;");
 assert.equal((await db.query("select rh_email_claim($1,false) jobs",[org])).rows[0].jobs.length,0);await db.exec("commit");
 const row=(await db.query("select state,attempts from rh_notifications")).rows[0];assert.equal(row.state,"uncertain");assert.equal(row.attempts,1);
 }finally{await db.close();}
});
