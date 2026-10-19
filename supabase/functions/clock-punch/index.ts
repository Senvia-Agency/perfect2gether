import { createClockPunchHandler } from './handler.ts';
import { clockRuntime } from '../_shared/clock-runtime.ts';
import { clockHttpProviders } from '../_shared/clock-validation.ts';
const runtime = clockRuntime();
Deno.serve(createClockPunchHandler({
    authenticate: runtime.authenticate,
    recordAttempt: async (org, user, input, reason) => {
        await runtime.rpc('p2g_clock_attempt', {
            _org: org, _user: user, _input: input, _reason: reason
        });
    }, context: (org, user, requestId) => runtime.rpc('p2g_clock_context', {
        _org: org, _user: user, _request: requestId
    }), register: (org, user, input, decision) => runtime.rpc('p2g_clock_register', {
        _org: org, _user: user, _input: input, _decision: decision
    }), providers: clockHttpProviders({
        fetch, proxyKey: Deno.env.get('PROXYCHECK_API_KEY'), ingressSecret: Deno.env.get('CLOCK_INGRESS_SECRET')
    })
}));
