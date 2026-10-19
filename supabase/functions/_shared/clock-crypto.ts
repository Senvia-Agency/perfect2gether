// AES-CMAC and NTAG424 encrypted-PICC SUN profile, NXP AN12196 sections 4.4.3–4.4.4.
import { ClockError } from './clock-contract.ts';
export function fromHex(value: string): Uint8Array<ArrayBuffer> {
    if (!/^(?:[a-f\d]{2})+$/i.test(value))
        throw new ClockError(403, 'invalid_nfc');
    return Uint8Array.from(value.match(/../g) ?? [], byte => parseInt(byte, 16));
}
export function toHex(value: Uint8Array): string {
    return Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
}
export function equalSecret(left: string, right: string): boolean {
    let difference = left.length ^ right.length;
    for (let i = 0; i < Math.max(left.length, right.length); i++)
        difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
    return difference === 0;
}
export async function sha256(value: string): Promise<string> {
    return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
async function aesBlock(key: Uint8Array<ArrayBuffer>, block: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const imported = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt']);
    return new Uint8Array(await crypto.subtle.encrypt({
        name: 'AES-CBC', iv: new Uint8Array(16)
    }, imported, block)).slice(0, 16);
}
function xor(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(a, (v, i) => v ^ (b[i] ?? 0));
}
function double(block: Uint8Array): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(16);
    let carry = 0;
    for (let i = 15; i >= 0; i--) {
        const byte = block[i] ?? 0;
        out[i] = (byte << 1) | carry;
        carry = byte >>> 7;
    }
    if (carry)
        out[15] = (out[15] ?? 0) ^ 0x87;
    return out;
}
export async function aesCmac(key: Uint8Array<ArrayBuffer>, message: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const k1 = double(await aesBlock(key, new Uint8Array(16)));
    const k2 = double(k1);
    const complete = message.length > 0 && message.length % 16 === 0;
    const blocks = Math.max(1, Math.ceil(message.length / 16));
    let state = new Uint8Array(16);
    for (let i = 0; i < blocks - 1; i++)
        state = await aesBlock(key, xor(state, message.slice(i * 16, i * 16 + 16)));
    const tail = new Uint8Array(16);
    tail.set(message.slice((blocks - 1) * 16));
    if (!complete)
        tail[message.length % 16] = 0x80;
    return aesBlock(key, xor(state, xor(tail, complete ? k1 : k2)));
}
async function decryptPicc(key: Uint8Array<ArrayBuffer>, encrypted: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const imported = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt']);
    const padded = new Uint8Array(32);
    padded.set(encrypted);
    padded.set(await aesBlock(key, xor(encrypted, new Uint8Array(16).fill(16))), 16);
    return new Uint8Array(await crypto.subtle.decrypt({
        name: 'AES-CBC', iv: new Uint8Array(16)
    }, imported, padded));
}
export async function verifySun(input: {
    readonly key: string;
    readonly uid: string;
    readonly encrypted: string;
    readonly cmac: string;
    readonly counter: number;
}): Promise<boolean> {
    const key = fromHex(input.key);
    if (key.length !== 16)
        return false;
    const picc = await decryptPicc(key, fromHex(input.encrypted));
    if (picc[0] !== 0xc7)
        return false;
    const uid = picc.slice(1, 8);
    const counter = picc.slice(8, 11);
    const value = (counter[0] ?? 0) + 256 * (counter[1] ?? 0) + 65536 * (counter[2] ?? 0);
    if (!equalSecret(toHex(uid), input.uid.toLowerCase()) || value !== input.counter)
        return false;
    const seed = new Uint8Array(16);
    seed.set(fromHex('3cc300010080'));
    seed.set(uid, 6);
    seed.set(counter, 13);
    const session = await aesCmac(key, seed);
    const mac = await aesCmac(session, new Uint8Array(0));
    return equalSecret(toHex(mac.filter((_, i) => i % 2 === 1)), input.cmac.toLowerCase());
}
