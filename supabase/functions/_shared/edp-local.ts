export const EDP_MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

type MailAddress = {
  readonly Email: string;
  readonly Name?: string;
};

type MailpitAttachment = {
  readonly Filename: string;
  readonly ContentType: string;
  readonly Content: string;
};

export type MailpitPayload = {
  readonly From: MailAddress;
  readonly To: readonly MailAddress[];
  readonly Cc: readonly MailAddress[];
  readonly Subject: string;
  readonly HTML: string;
  readonly Text: string;
  readonly Attachments: readonly MailpitAttachment[];
  readonly Headers: Readonly<Record<string, string>>;
};

type AttachmentInput = {
  readonly filename: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
};

type MailpitInput = {
  readonly from: { readonly email: string; readonly name: string };
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly attachments: readonly AttachmentInput[];
  readonly dispatchId?: string;
};

export class EdpLocalTransportError extends Error {
  readonly name = 'EdpLocalTransportError';

  constructor(
    readonly kind: 'configuration' | 'rejected' | 'uncertain',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const LOCAL_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '[::1]',
  'host.docker.internal',
  'mailpit',
  'inbucket',
]);

export function parseLocalCaptureUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new EdpLocalTransportError('configuration', 'URL de captura local inválido', { cause: error });
  }
  if (url.protocol !== 'http:') {
    throw new EdpLocalTransportError('configuration', 'O capturador local requer HTTP');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new EdpLocalTransportError('configuration', 'O transporte EDP só aceita um destino local');
  }
  if (url.username || url.password) {
    throw new EdpLocalTransportError('configuration', 'Credenciais não são aceites no URL local');
  }
  url.pathname = '/api/v1/send';
  url.search = '';
  url.hash = '';
  return url;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function buildMailpitPayload(input: MailpitInput): MailpitPayload {
  const headers: Readonly<Record<string, string>> = input.dispatchId
    ? { 'X-P2G-EDP-Dispatch': input.dispatchId }
    : {};
  return {
    From: { Email: input.from.email, Name: input.from.name },
    To: input.to.map((email) => ({ Email: email })),
    Cc: input.cc.map((email) => ({ Email: email })),
    Subject: input.subject,
    HTML: input.html,
    Text: input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    Attachments: input.attachments.map((attachment) => ({
      Filename: attachment.filename,
      ContentType: attachment.contentType,
      Content: bytesToBase64(attachment.bytes),
    })),
    Headers: headers,
  };
}

export function estimateMailpitPayloadBytes(payload: MailpitPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export async function postToLocalCapture(
  endpoint: URL,
  payload: MailpitPayload,
): Promise<string> {
  if (estimateMailpitPayloadBytes(payload) > EDP_MAX_MESSAGE_BYTES) {
    throw new EdpLocalTransportError('rejected', 'Mensagem EDP excede o limite local de 25 MiB');
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new EdpLocalTransportError('uncertain', 'Resultado do capturador local desconhecido', { cause: error });
  }
  if (!response.ok) {
    const kind = response.status >= 500 || response.status === 408 || response.status === 425 || response.status === 429
      ? 'uncertain'
      : 'rejected';
    throw new EdpLocalTransportError(kind, `Capturador local recusou a mensagem (${response.status})`);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.ID !== 'string' || !body.ID) {
    throw new EdpLocalTransportError('uncertain', 'Capturador local não devolveu um identificador');
  }
  return body.ID;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
