import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createMessagesHandler } from './http.mjs';

export async function verifyTransport({ db, resolver, token, org, user, conversation, directory, id }) {
  let changes = 0;
  const handle = createMessagesHandler({ db, resolveIdentity: resolver, changed: () => changes++, filesDirectory: path.join(directory, 'files') });
  const server = http.createServer((req, res) => handle(req, res).catch(error => { res.writeHead(400); res.end(JSON.stringify({ message: error.message })); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${token}`, 'x-p2g-organization': org };
  const fileId = id(102), messageId = id(103), name = `${org}/${conversation}/${user}/${messageId}/${fileId}`;
  const metadata = { bucketName: 'p2g-chat-files', objectName: name, contentType: 'application/x-zip-compressed' };
  try {
    const created = await fetch(`${base}/storage/v1/upload/resumable`, { method: 'POST', headers: { ...headers, 'Upload-Length': '3', 'Upload-Metadata': Object.entries(metadata).map(([key, value]) => `${key} ${Buffer.from(value).toString('base64')}`).join(',') }, body: Buffer.from('abc') });
    assert.equal(created.status, 201, await created.text());
    assert.equal(created.headers.get('Upload-Offset'), '3');
    const resumed = await fetch(base + created.headers.get('Location'), { method: 'HEAD', headers });
    assert.equal(resumed.headers.get('Upload-Offset'), '3');
    const sent = await fetch(`${base}/rest/v1/rpc/p2g_chat`, { method: 'POST', headers, body: JSON.stringify({ action: 'send', payload: { id: messageId, conversation, body: 'Anexo sintético local', attachments: [{ id: fileId, path: name, name: 'teste.zip', mime: metadata.contentType, size: 3 }] } }) });
    assert.equal(sent.status, 200, await sent.text());
    const sign = await fetch(`${base}/storage/v1/object/sign/p2g-chat-files/${name}`, { method: 'POST', headers, body: JSON.stringify({ expiresIn: 60 }) });
    assert.equal(sign.status, 200);
    const signed = `${base}/storage/v1${(await sign.json()).signedURL}`;
    const download = await fetch(signed);
    assert.equal(download.status, 200);
    assert.equal(await download.text(), 'abc');
    assert.equal(download.headers.get('Content-Disposition'), 'attachment');
    const removed = await fetch(`${base}/rest/v1/rpc/p2g_chat`, { method: 'POST', headers, body: JSON.stringify({ action: 'delete', payload: { conversation, message: messageId } }) });
    assert.equal(removed.status, 200);
    assert.equal((await fetch(signed)).status, 403);
    const anonymous = await fetch(`${base}/rest/v1/rpc/p2g_chat`, { method: 'POST', body: JSON.stringify({ action: 'snapshot', payload: { org } }) });
    assert.equal(anonymous.status, 400);
    assert.equal(changes, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
