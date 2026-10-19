import { createClockTagHandler } from './handler.ts';
import { clockRuntime } from '../_shared/clock-runtime.ts';
const runtime = clockRuntime();
Deno.serve(createClockTagHandler({
    authenticate: runtime.authenticate, manage: (org, actor, input) => runtime.rpc('p2g_clock_tag_manage', {
        _org: org, _actor: actor, _input: input
    })
}));
