import net from 'node:net';
import { createClockDatabase } from '../supabase/tests/timeclock-database-fixture.mjs';
import { createClockIdentityResolver } from './clock-local/identity.mjs';
import { createClockHandler } from './clock-local/http.mjs';
import { acquireLock } from './messages-local/lock.mjs';
import { createServer, loadEnv } from 'vite';
import { openDatabase } from './messages-local/database.mjs';
import { createIdentityResolver } from './messages-local/identity.mjs';
import { createMessagesHandler } from './messages-local/http.mjs';
import path from 'node:path';

const env = loadEnv('development', process.cwd(), '');
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Configure o .env normal do P2G antes de iniciar.');
const releaseLock = await acquireLock();
await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once("error", reject); probe.listen(8093, "127.0.0.1", () => probe.close(resolve)); }).catch(async error => { await releaseLock(); throw error; });
const db = await openDatabase();
const clockDb = await createClockDatabase(path.resolve('.clock.local'), { seed: false });
const resolveIdentity = createIdentityResolver({ db, url: env.VITE_SUPABASE_URL, publicKey: env.VITE_SUPABASE_PUBLISHABLE_KEY });
let vite;
let queue = Promise.resolve();
const handle = createMessagesHandler({ db, resolveIdentity, changed: () => vite?.ws.send('p2g-chat-changed', {}) });
const clockIdentity = createClockIdentityResolver({ db: clockDb, url: env.VITE_SUPABASE_URL, publicKey: env.VITE_SUPABASE_PUBLISHABLE_KEY });
const clockHandle = createClockHandler({ db: clockDb, resolveIdentity: clockIdentity, changed: () => vite?.ws.send('p2g-clock-changed', {}), loadGateways: async () => {
  const clockModules = Promise.all([vite.ssrLoadModule('/supabase/functions/clock-punch/handler.ts'), vite.ssrLoadModule('/supabase/functions/clock-tag-manage/handler.ts'), vite.ssrLoadModule('/supabase/functions/_shared/clock-errors.ts')]).then(([punch,tags,errors]) => ({ punch,tags,clockDatabaseError:errors.clockDatabaseError }));
  return clockModules;
} });
const localOnly = {
  name: 'p2g-local-messages',
  enforce: 'pre',
  resolveId(id) { if (id === 'npm:zod@3.25.76') return this.resolve('zod', undefined, { skipSelf: true }); },
  transform(code, id) {
    const normalized = id.replaceAll(String.fromCharCode(92), '/');
    if (normalized.endsWith('/src/modules/timeclock/api.ts')) return { code: code.replaceAll("from '@/integrations/supabase/client'", "from '" + path.resolve('scripts/clock-local/client.ts').replaceAll(String.fromCharCode(92), '/') + "'"), map: null };
    if (!id.replaceAll(String.fromCharCode(92), '/').includes('/src/modules/messages/')) return;
    let result = code.replaceAll("from '@/integrations/supabase/client'", `from '${path.resolve('scripts/messages-local/client.ts').replaceAll(String.fromCharCode(92), '/')}'`);
    if (id.endsWith('/uploads.ts')) result = result.replaceAll('import.meta.env.VITE_SUPABASE_URL', 'window.location.origin');
    if (id.endsWith('/useMessages.ts')) {
      result = result.replace('channel.subscribe();', "import.meta.hot?.on('p2g-chat-changed', changed);");
      result = result.replace('void supabase.removeChannel(channel);', "import.meta.hot?.off('p2g-chat-changed', changed); void supabase.removeChannel(channel);");
    }
    return { code: result, map: null };
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/__p2g-clock/')) {
        queue = queue.then(() => clockHandle(req, res)).catch(error => {
          if (res.headersSent) return res.end();
          res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ code: error.code || 'LOCAL_CLOCK', message: error.message }));
        });
        return;
      }
      if (!req.url?.startsWith('/rest/v1/rpc/p2g_chat') && !req.url?.startsWith('/storage/v1/')) return next();
      queue = queue.then(() => handle(req, res)).catch(error => {
        if (res.headersSent) return res.end();
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'LOCAL_MESSAGES', message: error.message }));
      });
    });
  },
};
vite = await createServer({ mode: 'development', plugins: [localOnly], optimizeDeps: { force: true, include: ['@radix-ui/react-tabs'] }, server: { host: '127.0.0.1', port: 8093, strictPort: true } });
await vite.listen();
console.log('P2G completo: http://127.0.0.1:8093/messages');
console.log('Login e restantes módulos habituais. Mensagens/anexos em .messages.local; ponto em .clock.local. Nenhum registo de ponto é enviado à produção.');
const close = async () => { await vite.close(); await queue; await db.close(); await clockDb.close(); await releaseLock(); process.exit(0); };
process.on('SIGINT', close); process.on('SIGTERM', close);
