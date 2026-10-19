import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { internalAutomationGate } from '../_shared/internal-automation.ts';
import { z } from 'https://esm.sh/zod@3.25.76';

const pushSchema = z.object({ id: z.string().uuid(), conversation_id: z.string().uuid(), message_id: z.string().uuid(), user_id: z.string().uuid(), organization_id: z.string().uuid(), attempts: z.number() });
const cleanupSchema = z.object({ path: z.string(), attempts: z.number() });
const batchSchema = z.object({ push: z.array(pushSchema), cleanup: z.array(cleanupSchema) });
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const denied = internalAutomationGate(req); if (denied) return denied;
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return Response.json({ error: 'Worker configuration unavailable' }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    const { data, error } = await db.rpc('p2g_chat_take_work'); if (error) throw error;
    const batch = batchSchema.parse(data);
    let delivered = 0, removed = 0;
    for (const job of batch.push) {
      try {
        const [member, message, preference, active] = await Promise.all([
          db.from('p2g_chat_members').select('last_read_at,joined_at').eq('conversation_id', job.conversation_id).eq('user_id', job.user_id).maybeSingle(),
          db.from('p2g_chat_messages').select('created_at,deleted_at').eq('id', job.message_id).maybeSingle(),
          db.from('p2g_chat_preferences').select('muted').eq('conversation_id', job.conversation_id).eq('user_id', job.user_id).maybeSingle(),
          db.from('organization_members').select('is_active').eq('organization_id', job.organization_id).eq('user_id', job.user_id).maybeSingle(),
        ]);
        for (const result of [member, message, preference, active]) if (result.error) throw result.error;
        const eligible = member.data && message.data && !message.data.deleted_at && active.data?.is_active && !preference.data?.muted &&
          message.data.created_at >= member.data.joined_at && (!member.data.last_read_at || member.data.last_read_at < message.data.created_at);
        if (eligible) {
          const result = await fetch(`${url}/functions/v1/send-push-notification`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ organization_id: job.organization_id, user_ids: [job.user_id], title: 'Nova mensagem no P2G', body: 'Abra a aplicação para ler a mensagem.', url: `/messages?conversation=${job.conversation_id}`, tag: `chat-${job.id}` }), signal: AbortSignal.timeout(20000) });
          const outcome = z.object({ sent: z.number(), total: z.number().optional().default(0) }).safeParse(await result.json());
          if (!result.ok || !outcome.success || (outcome.data.total > 0 && outcome.data.sent === 0)) throw new Error('Push delivery failed');
        }
        const result = await db.from('p2g_chat_push_jobs').update({ delivered_at: new Date().toISOString(), locked_until: null, last_error: null }).eq('id', job.id);
        if (result.error) throw result.error;
        delivered++;
      } catch (error: unknown) {
        const result = await db.from('p2g_chat_push_jobs').update({ locked_until: null, next_attempt_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000).toISOString(), last_error: error instanceof Error ? error.message : 'Push processing failed' }).eq('id', job.id);
        if (result.error) throw result.error;
      }
    }
    for (const job of batch.cleanup) {
      try {
        const { error } = await db.storage.from('p2g-chat-files').remove([job.path]); if (error) throw error;
        const result = await db.from('p2g_chat_file_cleanup').update({ completed_at: new Date().toISOString(), locked_until: null, last_error: null }).eq('path', job.path);
        if (result.error) throw result.error;
        removed++;
      } catch (error: unknown) {
        const result = await db.from('p2g_chat_file_cleanup').update({ locked_until: null, next_attempt_at: new Date(Date.now() + 60000).toISOString(), last_error: error instanceof Error ? error.message : 'File cleanup failed' }).eq('path', job.path);
        if (result.error) throw result.error;
      }
    }
    return Response.json({ delivered, removed });
  } catch (error: unknown) {
    console.error('Chat worker failed', error instanceof Error ? error.message : 'Unknown worker error');
    return Response.json({ error: 'Chat worker failed' }, { status: 500 });
  }
});
