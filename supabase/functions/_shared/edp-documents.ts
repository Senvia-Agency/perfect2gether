export const EDP_DOCUMENT_BUCKET = 'edp-client-documents';
export const EDP_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type EdpDocumentMime = 'application/pdf' | 'image/jpeg' | 'image/png';

type ValidatedDocument = {
  readonly mimeType: EdpDocumentMime;
  readonly extension: 'pdf' | 'jpg' | 'png';
  readonly originalName: string;
  readonly sizeBytes: number;
};

type StoragePathInput = {
  readonly organizationId: string;
  readonly clientId: string;
  readonly documentId: string;
  readonly versionId: string;
  readonly mimeType: EdpDocumentMime;
};

export class EdpDocumentError extends Error {
  readonly name = 'EdpDocumentError';
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function detectMime(bytes: Uint8Array): EdpDocumentMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

function extensionFor(mimeType: EdpDocumentMime): 'pdf' | 'jpg' | 'png' {
  switch (mimeType) {
    case 'application/pdf': return 'pdf';
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
  }
}

export function validateEdpDocument(
  bytes: Uint8Array,
  declaredMime: string,
  originalName: string,
): ValidatedDocument {
  if (bytes.byteLength === 0) throw new EdpDocumentError('O ficheiro está vazio');
  if (bytes.byteLength > EDP_MAX_DOCUMENT_BYTES) throw new EdpDocumentError('O ficheiro excede 10 MiB');
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(declaredMime)) {
    throw new EdpDocumentError('Apenas PDF, JPEG ou PNG são aceites');
  }
  const detected = detectMime(bytes);
  if (!detected || detected !== declaredMime) {
    throw new EdpDocumentError('O conteúdo do ficheiro não corresponde ao MIME declarado');
  }
  const cleanedName = originalName.replace(/[\r\n]/g, ' ').trim();
  if (!cleanedName || cleanedName.length > 255) throw new EdpDocumentError('Nome de ficheiro inválido');
  return {
    mimeType: detected,
    extension: extensionFor(detected),
    originalName: cleanedName,
    sizeBytes: bytes.byteLength,
  };
}

export function buildEdpStoragePath(input: StoragePathInput): string {
  const extension = extensionFor(input.mimeType);
  return [input.organizationId, input.clientId, input.documentId, `${input.versionId}.${extension}`].join('/');
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function suggestEdpValidityDate(
  bytes: Uint8Array,
  mimeType: EdpDocumentMime,
  today: string,
): string | null {
  if (mimeType !== 'application/pdf') return null;
  const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 1024 * 1024)));
  for (const match of text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) {
    const candidate = match[1];
    if (!candidate || candidate < today) continue;
    const parsed = new Date(`${candidate}T00:00:00Z`);
    if (!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === candidate) return candidate;
  }
  return null;
}
