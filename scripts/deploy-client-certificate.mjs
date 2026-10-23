import { readFile } from 'node:fs/promises';

const project = process.env.PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!project || !token) throw new Error('Missing deployment configuration');
async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Database deployment failed: HTTP ${response.status}`);
  return response.json();
}
for (const [version, name] of [
  ['20261023083420', 'client_certificates'],
  ['20261023090848', 'resumable_client_certificates'],
]) {
  const applied = await query(`SELECT version FROM supabase_migrations.schema_migrations WHERE version='${version}'`);
  if (!Array.isArray(applied)) throw new Error('Invalid migration history response');
  if (applied.length === 0) {
    const sql = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8');
    await query(`BEGIN; ${sql}\nINSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${version}','${name}'); COMMIT;`);
    console.log(`Migration ${name} applied`);
  } else {
    console.log(`Migration ${name} already applied`);
  }
}
const columns = await query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_clients' AND column_name IN ('crc_code','certificate_data','certificate_checked_at')");
if (!Array.isArray(columns) || columns.length !== 3) throw new Error('Certificate schema verification failed');
console.log('Certificate schema verified');



