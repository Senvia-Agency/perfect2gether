import { ClockError } from './clock-contract.ts';
const accessCodes = ['access_denied', 'membership_required', 'service_only', 'configure_required', 'manage_required', 'own_entry_forbidden'] as const;
const inputCodes = ['reason_required', 'invalid_input', 'invalid_manual_time', 'invalid_decision', 'invalid_nfc', 'invalid_month', 'invalid_time', 'invalid_operation', 'invalid_action'] as const;
export function clockDatabaseError(error: {
    readonly code?: string;
    readonly message: string;
}): ClockError {
    if (accessCodes.some(code => code === error.message) || error.code === '42501')
        return new ClockError(403, 'access_denied');
    if (error.message === 'invalid_state' || error.message === 'job_not_claimed' || error.code === '23505')
        return new ClockError(409, error.message === 'invalid_state' ? 'invalid_state' : 'clock_conflict');
    if (inputCodes.some(code => code === error.message) || error.code === '22023' || error.code?.startsWith('22') || error.code === '23514' || error.code === '23503')
        return new ClockError(400, inputCodes.some(code => code === error.message) ? error.message : 'invalid_request');
    if (error.message === 'tag_not_found' || error.message === 'entry_not_found' || error.message === 'location_not_found')
        return new ClockError(404, 'not_found');
    return new ClockError(503, 'clock_operation_failed');
}
