import type { ClockLocation, Punch } from './clock-contract.ts';
export function haversine(a: {
    readonly latitude: number;
    readonly longitude: number;
}, b: {
    readonly latitude: number;
    readonly longitude: number;
}): number {
    const rad = Math.PI / 180;
    const dlat = (b.latitude - a.latitude) * rad;
    const dlon = (b.longitude - a.longitude) * rad;
    const sum = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(sum), Math.sqrt(Math.max(0, 1 - sum)));
}
export function closest(input: Punch, locations: readonly ClockLocation[]): {
    readonly location: ClockLocation;
    readonly distance: number;
} | null {
    if (!input.position)
        return null;
    let result: {
        location: ClockLocation;
        distance: number;
    } | null = null;
    for (const location of locations) {
        const distance = haversine(input.position, location);
        if (!result || distance < result.distance)
            result = {
                location, distance
            };
    }
    return result;
}
