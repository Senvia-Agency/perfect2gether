type BrevoAddress = {
  readonly email: string;
  readonly name?: string;
};

type BrevoAttachment = {
  readonly name: string;
  readonly content: string;
};

export type BrevoPayload = {
  readonly sender: BrevoAddress;
  readonly to: readonly BrevoAddress[];
  readonly cc: readonly BrevoAddress[];
  readonly subject: string;
  readonly htmlContent: string;
  readonly attachment: readonly BrevoAttachment[];
  readonly headers: Readonly<Record<string, string>>;
};

type BrevoInput = {
  readonly from: { readonly email: string; readonly name: string };
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly attachments: readonly {
    readonly filename: string;
    readonly contentType: string;
    readonly bytes: Uint8Array;
  }[];
  readonly dispatchId: string;
};

export class EdpBrevoError extends Error {
  readonly name = 'EdpBrevoError';

  constructor(
    readonly kind: 'configuration' | 'rejected' | 'uncertain',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function buildBrevoPayload(input: BrevoInput): BrevoPayload {
  return {
    sender: { email: input.from.email, name: input.from.name },
    to: input.to.map((email) => ({ email })),
    cc: input.cc.map((email) => ({ email })),
    subject: input.subject,
    htmlContent: input.html,
    attachment: input.attachments.map((attachment) => ({
      name: attachment.filename,
      content: bytesToBase64(attachment.bytes),
    })),
    headers: { 'X-P2G-EDP-Dispatch': input.dispatchId },
  };
}

export function assertEdpSendEnabled(serverGate: string | undefined, organizationGate: boolean): void {
  if (serverGate !== 'true') {
    throw new EdpBrevoError('configuration', 'Envio EDP desativado no servidor');
  }
  if (!organizationGate) {
    throw new EdpBrevoError('configuration', 'Envio EDP desativado para a organização');
  }
}

export async function postBrevoMessage(apiKey: string, payload: BrevoPayload): Promise<string> {
  if (!apiKey) throw new EdpBrevoError('configuration', 'Credencial Brevo EDP não configurada');
  let response: Response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new EdpBrevoError('uncertain', 'Resultado Brevo desconhecido', { cause: error });
  }
  if (!response.ok) {
    const kind = response.status >= 500 || response.status === 408 || response.status === 425 || response.status === 429
      ? 'uncertain'
      : 'rejected';
    throw new EdpBrevoError(kind, `Brevo recusou a mensagem (${response.status})`);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.messageId !== 'string' || !body.messageId) {
    throw new EdpBrevoError('uncertain', 'Brevo não devolveu messageId');
  }
  return body.messageId;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
