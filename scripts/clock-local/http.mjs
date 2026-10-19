import { clockSession } from '../../supabase/tests/timeclock-database-fixture.mjs';
export function createClockHandler({ db, resolveIdentity, loadGateways, changed }) {
  return async (req, res) => {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 262144) throw new Error('Pedido de ponto demasiado grande.'); chunks.push(chunk); }
    const text = Buffer.concat(chunks).toString();
    const input = JSON.parse(text || '{}');
    const identity = await resolveIdentity(req.headers.authorization, input.payload?.org ?? input.org ?? req.headers['x-p2g-organization']);
    await clockSession(db, identity.userId, 'authenticated', identity.aal);
    const path = new URL(req.url, 'http://localhost').pathname;
    function json(data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
    if (path === '/__p2g-clock/rest/v1/rpc/p2g_clock') {
      const result = (await db.query('SELECT public.p2g_clock($1,$2::jsonb) AS result', [input.action, JSON.stringify(input.payload)])).rows[0].result;
      if (input.action !== 'snapshot') changed();
      return json(result);
    }
    const { punch, tags, clockDatabaseError } = await loadGateways();
    async function service(name, args) {
      await clockSession(db, identity.userId, 'service_role', identity.aal);
      try { return (await db.query(`SELECT public.${name}(${args.map((_,i) => '$' + (i+1)).join(',')}) AS result`, args)).rows[0].result; }
      catch (error) { if (error instanceof Error) throw clockDatabaseError(error); throw error; }
    }
    const deps = { authenticate: async () => identity.userId };
    let handler;
    if (path.endsWith('/clock-punch')) handler = punch.createClockPunchHandler({ ...deps,
      context: (org, user, request) => service('p2g_clock_context', [org, user, request ?? null]),
      register: (org, user, value, decision) => service('p2g_clock_register', [org, user, JSON.stringify(value), JSON.stringify(decision)]),
      recordAttempt: (org, user, value, reason) => service('p2g_clock_attempt', [org, user, JSON.stringify(value), reason]),
      providers: { now: () => new Date(), trustedIp: () => null, network: async () => null, address: async () => null },
    });
    else if (path.endsWith('/clock-tag-manage')) handler = tags.createClockTagHandler({ ...deps, manage: (org, actor, value) => service('p2g_clock_tag_manage', [org, actor, JSON.stringify(value)]) });
    else return json({ error: 'not_found' }, 404);
    const request = new Request('http://127.0.0.1' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
    const response = await handler(request);
    const data = await response.json();
    if (response.ok) changed();
    return json(data, response.status);
  };
}
