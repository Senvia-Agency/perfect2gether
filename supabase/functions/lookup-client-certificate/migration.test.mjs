import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE organizations(id uuid PRIMARY KEY); CREATE TABLE crm_clients(id uuid PRIMARY KEY, organization_id uuid, company text, company_nif text, billing_target text, total_value numeric); INSERT INTO crm_clients(id,organization_id,company) VALUES ('00000000-0000-4000-8000-000000000004','96a3950e-31be-4c6d-abed-b82968c0d7e9','Legacy');`);
const migration = await readFile(new URL('../../migrations/20261023083420_client_certificates.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec("UPDATE crm_clients SET total_value=100 WHERE id='00000000-0000-4000-8000-000000000004'" );
await assert.rejects(db.exec("UPDATE crm_clients SET crc_code=NULL WHERE id='00000000-0000-4000-8000-000000000004'"), /CRC/);
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const user='00000000-0000-4000-8000-000000000001';
await db.query('INSERT INTO organizations VALUES ($1);', [org]);
await db.query('INSERT INTO auth.users VALUES ($1);', [user]);
await assert.rejects(db.query('INSERT INTO crm_clients(id,organization_id,company) VALUES ($1,$2,$3)', [user,org,'Company']), /CRC/);
await assert.rejects(db.query('INSERT INTO crm_clients(id,organization_id) VALUES ($1,$2)', [user,org]), /CRC/);
await db.query('INSERT INTO crm_clients(id,organization_id) VALUES ($1,$2)', ['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']);
await db.query('INSERT INTO crm_clients(id,organization_id,company,crc_code) VALUES ($1,$2,$3,$4)', [user,org,'Company','1234-5678-9012']);
await assert.rejects(db.query('UPDATE crm_clients SET crc_code=NULL WHERE id=$1', [user]), /CRC/);
await db.query('SELECT claim_client_certificate_lookup($1,$2,$3)', [org,user,'1234-5678-9012']);
await assert.rejects(db.query('SELECT claim_client_certificate_lookup($1,$2,$3)', [org,user,'1234-5678-9012']), /lookup_limit/);
const privileges=await db.query("SELECT has_table_privilege('authenticated','client_certificate_lookups','SELECT') AS allowed,has_function_privilege('authenticated','claim_client_certificate_lookup(uuid,uuid,text)','EXECUTE') AS callable");
assert.deepEqual(privileges.rows,[{allowed:false,callable:false}]);
await db.close();
console.log('Migration: P2G mandatory CRC and other-org optional CRC, atomic cooldown, and browser privilege denial passed.');


