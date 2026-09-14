import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { asUser, fix, id, org, otherOrg, readMigration, setup, thirdOrg } from './security-database-fixture.mjs';

const denied = (action) => assert.rejects(action, (error) => error.code === '42501');
const insertJob = `insert into prospect_generation_jobs (organization_id,user_id) values ('${org}','${id(1)}')`;
const insertCommission = `insert into stripe_commission_records (organization_id,sale_id,user_id,client_org_id)
  values ('${org}','${id(600)}','${id(1)}','${org}')`;

test('security database access boundaries and compatibility', async (t) => {
  const db = new PGlite();
  try {
    await setup(db);
    for (const [label, user, role, expected] of [
      ['anonymous', null, 'anon', []],
      ['commercial member', id(1), 'authenticated', [org]],
      ['admin', id(5), 'authenticated', [org]],
      ['super admin', id(6), 'authenticated', [org, otherOrg, thirdOrg]],
      ['multi-org member before switching JWT', id(7), 'authenticated', [org, otherOrg]],
      ['unrelated tenant member', id(8), 'authenticated', [thirdOrg]],
    ]) {
      await t.test(`${label} reads only permitted organization rows`, () => asUser(db, user, async () => {
        const result = await db.query('select id from organizations order by id');
        assert.deepEqual(result.rows.map((row) => row.id), expected);
      }, role));
    }
    await t.test('commercial internal integration configuration remains readable', () => asUser(db, id(1), async () => {
      assert.deepEqual((await db.query('select brevo_api_key from organizations')).rows, [{brevo_api_key: 'fixture-secret'}]);
    }));
    await t.test('anonymous public form RPC retains safe projected organization details', () => asUser(db, null, async () => {
      const result = await db.query("select * from get_form_by_slugs('fixture-a','contact')");
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].org_name, 'Fixture A');
      assert.equal(result.rows[0].public_key, id(101));
      assert.equal(Object.hasOwn(result.rows[0], 'brevo_api_key'), false);
    }, 'anon'));
    for (const [label, user, role] of [['anonymous', null, 'anon'], ['commercial', id(1), 'authenticated'], ['admin', id(5), 'authenticated']]) {
      await t.test(`${label} cannot forge stripe commission records`, () => asUser(db, user, () => denied(() => db.exec(insertCommission)), role));
      await t.test(`${label} cannot forge prospect jobs`, () => asUser(db, user, () => denied(() => db.exec(insertJob)), role));
      await t.test(`${label} cannot overwrite prospect results`, () => asUser(db, user, async () => {
        const result = await db.query("update prospect_generation_jobs set status='completed',result='{}' returning id");
        assert.equal(result.rows.length, 0);
      }, role));
      await t.test(`${label} cannot blindly overwrite jobs without requesting returned rows`, () => asUser(db, user, async () => {
        await db.exec("update prospect_generation_jobs set status='completed'");
        await db.exec('reset role');
        assert.deepEqual((await db.query('select status from prospect_generation_jobs')).rows, [{status: 'pending'}]);
      }, role));
    }
    await t.test('server integration can insert commission records and manage prospect jobs', () => asUser(db, null, async () => {
      await db.exec(insertCommission);
      await db.exec(insertJob);
      const result = await db.query("update prospect_generation_jobs set status='completed' returning id");
      assert.equal(result.rows.length, 2);
    }, 'service_role'));
    for (const [label, user, expected] of [['member', id(1), 1], ['outsider', id(8), 0]]) {
      await t.test(`${label} retains existing stripe and prospect job read scope`, () => asUser(db, user, async () => {
        assert.equal((await db.query('select id from stripe_commission_records')).rows.length, expected);
        assert.equal((await db.query('select id from prospect_generation_jobs')).rows.length, expected);
      }));
    }
    for (const [label, user, expected] of [
      ['own', id(1), [id(1)]],
      ['team', id(3), [id(1), id(3)]],
      ['all', id(4), [id(1), id(2), id(3), id(4), id(5), id(6), id(7)]],
      ['admin', id(5), [id(1), id(2), id(3), id(4), id(5), id(6), id(7)]],
      ['super admin', id(6), [id(1), id(2), id(3), id(4), id(5), id(6), id(7), id(8)]],
      ['unrelated tenant', id(8), [id(8)]],
    ]) {
      await t.test(`${label} commitment visibility matches configured scope and organization boundary`, () => asUser(db, user, async () => {
        const result = await db.query('select user_id from monthly_commitments order by user_id');
        assert.deepEqual(result.rows.map((row) => row.user_id), expected);
        assert.equal((await db.query('select id from commitment_lines')).rows.length, expected.length);
      }));
    }
    await t.test('commercial own commitment insert, update, upsert and delete remain allowed', () => asUser(db, id(1), async () => {
      await db.exec(`insert into monthly_commitments (organization_id,user_id,month) values ('${org}','${id(1)}','2099-10-01')`);
      const updated = await db.query(`update monthly_commitments set total_nifs=5 where user_id='${id(1)}' returning id`);
      assert.equal(updated.rows.length, 2);
      const upsert = await db.query(`insert into monthly_commitments (organization_id,user_id,month,total_nifs)
        values ('${org}','${id(1)}','2099-09-01',6) on conflict (organization_id,user_id,month)
        do update set total_nifs=excluded.total_nifs returning total_nifs`);
      assert.equal(upsert.rows[0].total_nifs, 6);
      assert.equal((await db.query(`delete from monthly_commitments where user_id='${id(1)}' returning id`)).rows.length, 2);
    }));
    await t.test('commercial cannot transfer commitment ownership', () => asUser(db, id(1), () => denied(() =>
      db.exec(`update monthly_commitments set user_id='${id(2)}', month='2099-10-01' where user_id='${id(1)}'`))));
    await t.test('commercial cannot transfer commitment to another organization', () => asUser(db, id(1), () => denied(() =>
      db.exec(`update monthly_commitments set organization_id='${otherOrg}' where user_id='${id(1)}'`))));
    if (process.env.P2G_SECURITY_BASELINE !== '1') {
      await t.test('migration can be safely reapplied', async () => {
        await db.exec(await readMigration(fix));
        await asUser(db, null, async () => assert.equal((await db.query('select id from organizations')).rows.length, 0), 'anon');
      });
    }
  } finally {
    await db.close();
  }
});
