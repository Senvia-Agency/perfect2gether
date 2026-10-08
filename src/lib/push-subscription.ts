const pending = new WeakMap<PushManager, Promise<PushSubscription>>();

export function publicKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const binary = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function subscriptionUsesKey(subscription: PushSubscription, key: string): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const actual = new Uint8Array(current);
  const expected = publicKeyBytes(key);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

export function ensurePushSubscription(manager: PushManager, key: string): Promise<PushSubscription> {
  const existing = pending.get(manager);
  if (existing) return existing;
  const request = (async () => {
    const current = await manager.getSubscription();
    if (current && subscriptionUsesKey(current, key)) return current;
    if (current && !await current.unsubscribe()) throw new Error("Não foi possível renovar o registo de notificações.");
    return manager.subscribe({userVisibleOnly: true, applicationServerKey: publicKeyBytes(key).buffer});
  })();
  pending.set(manager, request);
  void request.finally(() => pending.delete(manager)).catch(() => undefined);
  return request;
}
