/** Only database triggers, scheduled workers and service callers may send automations. */
export function internalAutomationGate(req: Request): Response | null {
  const internalToken = Deno.env.get('P2G_AUTOMATION_TOKEN');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (serviceKey && authorization === `Bearer ${serviceKey}`) return null;
  if (internalToken && req.headers.get('x-p2g-automation-token') === internalToken) return null;
  return Response.json({ error: 'Não autorizado' }, { status: 401 });
}
