import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const original = new URL('../migrations/20260317151208_c01ed9fb-2c94-46a8-bf39-189246ce1d69.sql', import.meta.url);
const fix = new URL('../migrations/20260929130000_allow_energy_kwp.sql', import.meta.url);

test('energy proposal accepts solar kWp while rejecting service-only fields', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.proposals(
        id uuid primary key,
        proposal_type text,
        kwp numeric,
        servicos_produtos text[],
        servicos_details jsonb,
        modelo_servico text
      );
      create table public.proposal_cpes(id uuid primary key, proposal_id uuid references public.proposals(id));
    `);
    await db.exec(await readFile(original, 'utf8'));
    const solar = "'00000000-0000-4000-8000-000000000001'";
    await assert.rejects(
      () => db.exec(`insert into public.proposals(id,proposal_type,kwp) values (${solar},'energia',450)`),
      /Propostas de energia não podem conter dados de serviços/,
    );
    await db.exec(await readFile(fix, 'utf8'));
    await db.exec(`insert into public.proposals(id,proposal_type,kwp) values (${solar},'energia',450)`);
    assert.equal((await db.query(`select kwp from public.proposals where id=${solar}`)).rows[0].kwp, '450');
    await assert.rejects(
      () => db.exec(`insert into public.proposals(id,proposal_type,kwp,modelo_servico) values ('00000000-0000-4000-8000-000000000002','energia',450,'saas')`),
      /Propostas de energia não podem conter dados de serviços/,
    );
  } finally {
    await db.close();
  }
});
