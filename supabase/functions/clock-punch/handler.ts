import { ClockError, clockFailure, clockResponse, contextSchema, punchSchema, type Decision, type Punch } from '../_shared/clock-contract.ts';
import { evaluateClockPunch, type ClockProviders } from '../_shared/clock-validation.ts';
export type ClockPunchDependencies = {
    readonly authenticate: (request: Request) => Promise<string>;
    readonly context: (organizationId: string, userId: string, requestId: string) => Promise<unknown>;
    readonly register: (organizationId: string, userId: string, input: Punch, decision: Decision) => Promise<unknown>;
    readonly providers: ClockProviders;
    readonly recordAttempt?: (organizationId: string, userId: string, input: Readonly<Record<string, unknown>>, reason: string) => Promise<void>;
};
export function createClockPunchHandler(deps: ClockPunchDependencies): (request: Request) => Promise<Response> {
    return async (request) => {
        if (request.method === 'OPTIONS')
            return clockResponse({});
        if (request.method !== 'POST')
            return clockResponse({
                error: 'method_not_allowed'
            }, 405);
        try {
            const userId = await deps.authenticate(request);
            let input = punchSchema.parse(await request.json());
            const context = contextSchema.parse(await deps.context(input.org, userId, input.request_id));
            if (context.duplicate)
                return clockResponse(context.duplicate);
            if (input.tag) {
                const tag = context.tags.find(candidate => candidate.id === input.tag?.id);
                // A static URL is a revocable bearer token, never a cryptographic replay proof.
                if (tag?.kind === 'static')
                    input = {
                        ...input, tag: {
                            ...input.tag, counter: tag.last_counter + 1
                        }
                    };
            }
            let decision: Decision;
            try {
                decision = await evaluateClockPunch(input, userId, context, request, deps.providers);
            }
            catch (error) {
                if (error instanceof ClockError && error.status === 403 && deps.recordAttempt) {
                    await deps.recordAttempt(input.org, userId, {
                        request_id: input.request_id, action: input.action, device_id: input.device_id,
                        position: input.position, ...(input.tag ? {
                            tag: {
                                id: input.tag.id, counter: input.tag.counter
                            }
                        } : {})
                    }, error.code);
                }
                throw error;
            }
            return clockResponse(await deps.register(input.org, userId, input, decision));
        }
        catch (error) {
            return clockFailure(error);
        }
    };
}
