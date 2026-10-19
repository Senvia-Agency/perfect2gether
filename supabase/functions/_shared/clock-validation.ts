import { ClockError, type ClockContext, type Decision, type Punch } from './clock-contract.ts';
import { equalSecret, sha256, verifySun } from './clock-crypto.ts';
import { closest, haversine } from './clock-geography.ts';
import { fraudFlags } from './clock-fraud.ts';
export { haversine } from './clock-geography.ts';
export { clockHttpProviders } from './clock-providers.ts';
export type ClockProviders = {
    readonly now: () => Date;
    readonly trustedIp: (request: Request) => string | null;
    readonly network: (ip: string) => Promise<{
        readonly proxy: boolean;
        readonly vpn: boolean;
        readonly tor: boolean;
    } | null>;
    readonly address: (latitude: number, longitude: number) => Promise<string | null>;
};
export async function evaluateClockPunch(input: Punch, userId: string, context: ClockContext, request: Request, providers: ClockProviders): Promise<Decision> {
    const active = context.locations.filter(location => location.is_active);
    const nearest = closest(input, active);
    const ip = providers.trustedIp(request);
    const networkLocation = ip ? active.find(candidate => candidate.trusted_ips.includes(ip)) ?? null : null;
    let location = nearest?.location ?? networkLocation;
    let distance = nearest?.distance ?? null;
    const flags = fraudFlags(input, userId, context, providers.now());
    let pending = false;
    let nfc = false;
    if (input.tag) {
        const proof = input.tag;
        const tag = context.tags.find(candidate => candidate.id === proof.id && candidate.is_active);
        if (!tag || proof.counter === undefined || proof.counter <= tag.last_counter)
            throw new ClockError(403, 'nfc_replay_or_invalid');
        location = active.find(candidate => candidate.id === tag.location_id) ?? null;
        if (!location)
            throw new ClockError(403, 'invalid_nfc_location');
        if (location.gps_only)
            throw new ClockError(403, 'gps_required');
        let valid = false;
        switch (tag.kind) {
            case 'static':
                valid = !!tag.token_hash && !!proof.token && equalSecret(await sha256(proof.token), tag.token_hash);
                break;
            case 'ntag424':
                valid = !!tag.aes_key && !!tag.uid_hex && !!proof.picc_data && !!proof.cmac && await verifySun({
                    key: tag.aes_key, uid: tag.uid_hex, encrypted: proof.picc_data, cmac: proof.cmac, counter: proof.counter
                });
                break;
        }
        if (!valid)
            throw new ClockError(403, 'invalid_nfc');
        nfc = true;
        distance = input.position ? haversine(input.position, location) : null;
    }
    const networkPresence = !!networkLocation && !networkLocation.gps_only;
    if (networkPresence && !nfc) {
        location = networkLocation;
        distance = input.position ? haversine(input.position, networkLocation) : null;
    }
    if (!nfc) {
        if (!input.position) {
            if (!networkPresence) {
                flags.push('no_gps');
                pending = true;
            }
        }
        else {
            if (!location || distance === null || distance > location.radius_m) {
                flags.push('outside_location');
                if (!networkPresence)
                    pending = true;
            }
            if (input.position.age_ms > 120000) {
                flags.push('stale_position');
                if (!networkPresence)
                    pending = true;
            }
            if (location && input.position.accuracy > location.max_accuracy_m) {
                flags.push('poor_accuracy');
                if (!networkPresence)
                    pending = true;
            }
        }
    }
    let network: Awaited<ReturnType<ClockProviders['network']>> = null;
    if (ip) {
        network = await providers.network(ip);
        if (!network) {
            flags.push('network_unavailable');
            pending = true;
        }
        else {
            if (network.vpn)
                flags.push('vpn');
            if (network.proxy)
                flags.push('proxy');
            if (network.tor)
                flags.push('tor');
            if (location?.block_vpn && (network.vpn || network.proxy || network.tor))
                throw new ClockError(403, 'network_blocked');
        }
    }
    else if (input.action !== 'pause') {
        flags.push('network_unavailable');
        if (location?.block_vpn)
            pending = true;
    }
    const address = flags.includes('outside_location') && input.position ? await providers.address(input.position.latitude, input.position.longitude) : null;
    return {
        status: pending ? 'pending' : flags.length ? 'flagged' : 'valid', flags, source: nfc ? 'nfc' : 'gps', location_id: location?.id ?? null, location_name: location?.name ?? null, address, distance_m: distance === null ? null : Math.round(distance), metadata: {
            ip, network, device_id: input.device_id, position: input.position, received_at: providers.now().toISOString(), network_presence: networkPresence, ...(input.tag ? {
                tag_id: input.tag.id, tag_counter: input.tag.counter
            } : {})
        }
    };
}
