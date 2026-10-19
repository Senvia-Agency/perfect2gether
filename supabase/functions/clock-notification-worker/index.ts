import { z } from 'npm:zod@3.25.76';
import { createClockWorkerHandler } from './handler.ts';
import { clockRuntime } from '../_shared/clock-runtime.ts';
import { ClockError } from '../_shared/clock-contract.ts';
const runtime = clockRuntime();
Deno.serve(createClockWorkerHandler({
    secret: Deno.env.get('CLOCK_WORKER_SECRET'), deliveryEnabled: Deno.env.get('CLOCK_DELIVERY_ENABLED') === 'true', rpc: (action, input) => runtime.rpc('p2g_clock_worker', {
        _action: action, _input: input
    }), deliver: async (job, message) => {
        switch (job.channel) {
            case 'notification': return;
            case 'push': {
                const response = await fetch(`${runtime.url}/functions/v1/send-push-notification`, {
                    method: 'POST', headers: {
                        Authorization: `Bearer ${runtime.service}`, 'Content-Type': 'application/json'
                    }, body: JSON.stringify({
                        organization_id: job.organization_id, user_ids: [job.user_id], title: message.title, body: message.body, url: message.url, tag: message.idempotencyKey
                    }), signal: AbortSignal.timeout(15000)
                });
                if (!response.ok)
                    throw new ClockError(502, 'push_failed');
                return;
            }
            case 'email': {
                const { data: user, error } = await runtime.db.auth.admin.getUserById(job.user_id);
                if (error || !user.user?.email)
                    throw new ClockError(502, 'recipient_unavailable');
                const { data: organization, error: orgError } = await runtime.db.from('organizations').select('name,brevo_api_key,brevo_sender_email').eq('id', job.organization_id).single();
                if (orgError)
                    throw new ClockError(502, 'sender_unavailable');
                const org = z.object({
                    name: z.string(), brevo_api_key: z.string().nullable(), brevo_sender_email: z.string().nullable()
                }).parse(organization);
                const token = org.brevo_api_key || Deno.env.get('BREVO_API_KEY');
                const sender = org.brevo_sender_email || Deno.env.get('CLOCK_EMAIL_SENDER');
                if (!token || !sender)
                    throw new ClockError(503, 'email_not_configured');
                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST', headers: {
                        'api-key': token, 'Content-Type': 'application/json'
                    }, body: JSON.stringify({
                        sender: {
                            email: sender, name: org.name
                        }, to: [{
                                email: user.user.email
                            }], subject: message.title, textContent: `${message.body} https://app.perfect2gether.pt${message.url}`, headers: {
                            idempotencyKey: message.idempotencyKey
                        }
                    }), signal: AbortSignal.timeout(15000)
                });
                if (!response.ok)
                    throw new ClockError(502, 'email_failed');
                return;
            }
        }
    }
}));
