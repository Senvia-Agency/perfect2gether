type RpcResult<T> = { readonly data: T | null; readonly error: { readonly code?: string; readonly message: string } | null };
export class RhBackendUnavailableError extends Error {
  constructor() { super("O serviço de Recursos Humanos ainda não está configurado neste ambiente."); this.name = "RhBackendUnavailableError"; }
}
export async function loadRh<T>(request: (signal: AbortSignal) => PromiseLike<RpcResult<T>>, timeoutMs = 15000): Promise<T | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new Error("O serviço RH não respondeu a tempo. Tente novamente.")); controller.abort(); }, timeoutMs);
  });
  try {
    const result = await Promise.race([Promise.resolve(request(controller.signal)), timeout]);
    if (result.error?.code === "PGRST202") throw new RhBackendUnavailableError();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
