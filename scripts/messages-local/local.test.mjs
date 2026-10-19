import { verifyTransport } from './transport-test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, assumeUser } from './database.mjs';
import { createIdentityResolver } from './identity.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org = id(1), user = id(3), peer = id(4);
const jwt = aal => `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.verified-by-test-endpoint`;

test('full-app local backend verifies real-session identity before mirroring and enforcing SQL permissions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'p2g-chat-local-test-'));
  const db = await openDatabase(directory);
  const calls = [];
  let active = true;
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.method, undefined, 'remote verification uses reads only');
    let data;
    if (url.includes('/auth/v1/user')) data = { id: user };
    else if (url.includes('/organization_members?')) data = [{ user_id: user, is_active: active, profile_id: null }, { user_id: peer, is_active: true, profile_id: null }];
    else if (url.includes('/profiles?')) data = [{ id: user, full_name: 'Conta local', avatar_url: null }, { id: peer, full_name: 'Colega local', avatar_url: null }];
    else if (url.includes('/organization_profiles?')) data = [];
    else if (url.includes('/user_roles?')) data = [{ role: 'admin' }];
    else throw new Error('Unexpected remote route');
    return Response.json(data);
  };
  const resolver = createIdentityResolver({ db, url: 'https://example.supabase.co', publicKey: 'public-key', fetcher });
  const rpc = async (action, payload) => (await db.query('SELECT public.p2g_chat($1,$2::jsonb) AS result', [action, JSON.stringify(payload)])).rows[0].result;
  try {
    await assert.rejects(resolver(undefined, org), /Inicie sessão/);
    assert.equal(calls.length, 0);
    const identity = await resolver(`Bearer ${jwt('aal2')}`, org);
    assert.equal(identity.userId, user);
    assert.equal(calls.length, 5);
    await assumeUser(db, identity);
    const snapshot = await rpc('snapshot', { org });
    assert.equal(snapshot.people.length, 2);
    assert.equal(snapshot.can_announce, true);
    const conversation = await rpc('create', { org, kind: 'group', title: 'Teste integrado', participants: [peer] });
    const message = await rpc('send', { id: id(100), conversation, body: 'Mensagem local dentro do P2G', attachments: [] });
    assert.equal(message.body, 'Mensagem local dentro do P2G');
    assert.equal((await rpc('history', { conversation })).length, 1);
    await verifyTransport({ db, resolver, token: jwt("aal2"), org, user, conversation, directory, id });
    const low = await resolver(`Bearer ${jwt('aal1')}`, org);
    await assumeUser(db, low);
    await assert.rejects(rpc('snapshot', { org }));
    active = false;
    const revoked = createIdentityResolver({ db, url: 'https://example.supabase.co', publicKey: 'public-key', fetcher });
    await assert.rejects(revoked(`Bearer ${jwt('aal2')}`, org), /Sem acesso ativo/);
    await db.exec('RESET ROLE');
  } finally {
    await db.close();
  }
  const reopened = await openDatabase(directory);
  assert.equal((await reopened.query("SELECT count(*)::int AS total FROM public.p2g_chat_messages")).rows[0].total, 2);
  await reopened.close();
  await rm(directory, { recursive: true, force: true });
});

test('exclusive local database lock rejects another runner and releases cleanly', async () => {
  const { acquireLock } = await import('./lock.mjs');
  const directory = await mkdtemp(path.join(tmpdir(), 'p2g-chat-lock-test-'));
  const filename = path.join(directory, 'runner.lock');
  try {
    const release = await acquireLock(filename);
    await assert.rejects(acquireLock(filename), /já está aberto/);
    await release();
    const second = await acquireLock(filename);
    await second();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
