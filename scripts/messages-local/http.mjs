import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { assumeUser } from './database.mjs';
import { isUuid } from './identity.mjs';
const bucket = 'p2g-chat-files';
const limit = 52428800;
const objectPath = value => typeof value === 'string' && value.split('/').length === 5 && value.split('/').every(isUuid);
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
async function body(req, max = 8 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > max) throw new Error('Pedido demasiado grande.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
const readJson = async req => JSON.parse((await body(req, 256 * 1024)).toString());

export function createMessagesHandler({ db, resolveIdentity, changed, filesDirectory = path.resolve('.messages.local/files') }) {
  const uploads = new Map(), tokens = new Map();
  const file = name => path.resolve(filesDirectory, ...name.split('/'));
  const visible = async name => (await db.query('SELECT name,metadata FROM storage.objects WHERE bucket_id=$1 AND name=$2', [bucket, name])).rows[0];
  async function cleanup() {
    await db.exec('RESET ROLE');
    const pending = (await db.query('SELECT path FROM public.p2g_chat_file_cleanup WHERE completed_at IS NULL')).rows;
    for (const item of pending) {
      if (!objectPath(item.path)) continue;
      await rm(file(item.path), { force: true });
      await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2', [bucket, item.path]);
      await db.query('UPDATE public.p2g_chat_file_cleanup SET completed_at=now() WHERE path=$1', [item.path]);
    }
  }
  async function finish(upload, identity) {
    if (upload.completed || upload.bytes.length !== upload.total) return;
    if (!objectPath(upload.meta.objectName)) throw new Error('Caminho de anexo inválido.');
    await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES($1,$2,$3,$4) ON CONFLICT(bucket_id,name) DO NOTHING', [bucket, upload.meta.objectName, identity.userId, JSON.stringify({ size: upload.total, mimetype: upload.meta.contentType })]);
    await mkdir(path.dirname(file(upload.meta.objectName)), { recursive: true });
    await writeFile(file(upload.meta.objectName), upload.bytes);
    upload.completed = true; upload.bytes = Buffer.alloc(0);
  }
  return async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    // Signed downloads are short-lived capabilities, just like hosted Storage URLs.
    if (req.method === 'GET' && u.pathname.startsWith('/storage/v1/object/sign/')) {
      const entry = tokens.get(u.searchParams.get('token'));
      if (!entry || entry.expires <= Date.now() || u.pathname !== entry.url) return json(res, { message: 'Ligação expirada.' }, 403);
      await assumeUser(db, entry.identity);
      if (!await visible(entry.name)) return json(res, { message: 'Ficheiro indisponível.' }, 403);
      const inline = new RegExp("^(image/(png|jpeg|gif|webp|avif)|audio/[a-z0-9.+-]+|video/[a-z0-9.+-]+)$", "i").test(entry.mime);
      res.writeHead(200, { 'Content-Type': inline ? entry.mime : 'application/octet-stream', 'Content-Disposition': inline ? 'inline' : 'attachment', 'X-Content-Type-Options': 'nosniff' });
      return res.end(await readFile(file(entry.name)));
    }
    let input;
    if (u.pathname.startsWith('/rest/') || (req.method === 'POST' && !u.pathname.includes('/resumable'))) input = await readJson(req);
    let org = input?.payload?.org || req.headers['x-p2g-organization'];
    const metadata = Object.fromEntries(String(req.headers['upload-metadata'] || '').split(',').filter(Boolean).map(item => { const [key, value] = item.split(' '); return [key, Buffer.from(value || '', 'base64').toString()]; }));
    const uploadId = u.pathname.split('/').pop();
    const upload = uploads.get(uploadId);
    if (!org && metadata.objectName) org = metadata.objectName.split('/')[0];
    if (!org && upload) org = upload.meta.objectName.split('/')[0];
    const identity = await resolveIdentity(req.headers.authorization, org);
    await assumeUser(db, identity);
    if (u.pathname === '/rest/v1/rpc/p2g_chat') {
      const result = (await db.query('SELECT public.p2g_chat($1,$2::jsonb) AS result', [input.action, JSON.stringify(input.payload)])).rows[0].result;
      await cleanup();
      if (!['snapshot', 'history', 'search', 'saved'].includes(input.action)) changed();
      return json(res, result);
    }
    if (u.pathname === `/storage/v1/object/list/${bucket}`) {
      const rows = (await db.query('SELECT name,metadata FROM storage.objects WHERE bucket_id=$1 AND name LIKE $2', [bucket, input.prefix + '/%'])).rows;
      return json(res, rows.map(item => ({ ...item, name: item.name.split('/').pop() })).filter(item => !input.search || item.name.includes(input.search)));
    }
    if (req.method === 'POST' && u.pathname.startsWith(`/storage/v1/object/sign/${bucket}/`)) {
      const name = decodeURIComponent(u.pathname.split(`/${bucket}/`)[1]);
      const item = await visible(name);
      if (!item) return json(res, { message: 'Sem acesso ao anexo.' }, 403);
      if (tokens.size > 1000) for (const [key, entry] of tokens) if (entry.expires < Date.now()) tokens.delete(key);
      const token = crypto.randomUUID(), route = `/storage/v1/object/sign/${bucket}/${name}`;
      tokens.set(token, { name, identity, mime: item.metadata.mimetype || 'application/octet-stream', expires: Date.now() + 60000, url: route });
      return json(res, { signedURL: `/object/sign/${bucket}/${name}?token=${token}` });
    }
    if (u.pathname === '/storage/v1/object/copy') {
      const item = await visible(input.sourceKey);
      if (!item || !objectPath(input.destinationKey) || input.bucketId !== bucket) throw new Error('Sem acesso ao anexo.');
      await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES($1,$2,$3,$4)', [bucket, input.destinationKey, identity.userId, JSON.stringify(item.metadata)]);
      await mkdir(path.dirname(file(input.destinationKey)), { recursive: true });
      await copyFile(file(input.sourceKey), file(input.destinationKey));
      return json(res, { Key: `${bucket}/${input.destinationKey}` });
    }
    if (u.pathname.startsWith('/storage/v1/upload/resumable')) {
      res.setHeader('Tus-Resumable', '1.0.0');
      if (req.method === 'POST') {
        const total = Number(req.headers['upload-length']);
        if (!Number.isSafeInteger(total) || total <= 0 || total > limit || metadata.bucketName !== bucket || !objectPath(metadata.objectName) || metadata.objectName.split('/')[2] !== identity.userId || metadata.objectName.split('/')[0] !== identity.org) throw new Error('Anexo inválido ou acima de 50 MiB.');
        const key = crypto.randomUUID();
        const next = { meta: metadata, total, userId: identity.userId, bytes: await body(req) };
        if (next.bytes.length > total) throw new Error('Tamanho de anexo inválido.');
        uploads.set(key, next); await finish(next, identity);
        res.setHeader('Location', `/storage/v1/upload/resumable/${key}`);
        res.setHeader('Upload-Offset', next.completed ? next.total : next.bytes.length); res.writeHead(201); return res.end();
      }
      if (!upload || upload.userId !== identity.userId) return json(res, { message: 'Upload indisponível.' }, 404);
      if (req.method === 'HEAD') { res.setHeader('Upload-Length', upload.total); res.setHeader('Upload-Offset', upload.completed ? upload.total : upload.bytes.length); res.writeHead(200); return res.end(); }
      if (req.method === 'PATCH') {
        if (Number(req.headers['upload-offset']) !== (upload.completed ? upload.total : upload.bytes.length)) return json(res, {}, 409);
        if (upload.completed) { res.setHeader('Upload-Offset', upload.total); res.writeHead(204); return res.end(); }
        const chunk = await body(req);
        if (upload.bytes.length + chunk.length > upload.total) throw new Error('Tamanho de anexo inválido.');
        upload.bytes = Buffer.concat([upload.bytes, chunk]); await finish(upload, identity);
        res.setHeader('Upload-Offset', upload.completed ? upload.total : upload.bytes.length); res.writeHead(204); return res.end();
      }
    }
    return json(res, { message: 'Operação local não suportada.' }, 404);
  };
}
