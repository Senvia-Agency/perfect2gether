import { positionSchema, type ClockContext, type Punch } from './clock-contract.ts';
import { haversine } from './clock-geography.ts';
function previousPoint(previous: ClockContext['previous'][number]) {
    const stored = positionSchema.safeParse(previous.metadata?.position);
    return previous.position ?? (stored.success ? stored.data : typeof previous.latitude === 'number' && typeof previous.longitude === 'number' ? {
        latitude: previous.latitude, longitude: previous.longitude
    } : null);
}
export function fraudFlags(input: Punch, userId: string, context: ClockContext, now: Date): string[] {
    const flags: string[] = [];
    const effective = context.previous.filter(previous => previous.status !== 'voided');
    const known = context.devices.some(device => device.user_id === userId && device.device_id === input.device_id) || effective.some(previous => (previous.device_id ?? previous.metadata?.device_id) === input.device_id);
    if (!known)
        flags.push('new_device');
    if (context.devices.some(device => device.user_id !== userId && device.device_id === input.device_id))
        flags.push('shared_device');
    const position = input.position;
    if (position) {
        if (position.accuracy < 2)
            flags.push('perfect_accuracy');
        const repeated = effective.filter(previous => {
            const point = previousPoint(previous);
            return point && point.latitude === position.latitude && point.longitude === position.longitude;
        });
        if (repeated.length >= 3)
            flags.push('repeated_coordinates');
        const last = effective[0];
        const point = last ? previousPoint(last) : null;
        if (last && point) {
            const elapsed = (now.getTime() - Date.parse(last.punched_at)) / 1000;
            if (elapsed > 0 && haversine(point, position) / elapsed > 250 / 3.6)
                flags.push('teleport');
        }
    }
    if (input.at)
        flags.push('manual_time');
    return flags;
}
