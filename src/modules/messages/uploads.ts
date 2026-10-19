import { z } from 'zod';
import { Upload } from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';
import type { Attachment } from './types';

type UploadInput = {
  readonly file: File; readonly org: string; readonly conversation: string;
  readonly user: string; readonly message: string; readonly id: string;
  readonly maxBytes: number; readonly onProgress: (percent: number) => void;
  readonly signal?: AbortSignal;
};
const idsSchema = z.array(z.string().uuid()).length(5);
const objectMetadataSchema = z.object({ size: z.number(), mimetype: z.string().optional() });
const bucket = 'p2g-chat-files';
const mediaType = (file: File) => (file.type.split(';', 1)[0] || 'application/octet-stream').trim().toLowerCase();

class AttachmentUploadError extends Error {
  constructor(message: string) { super(message); this.name = 'AttachmentUploadError'; }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Number((bytes / 1024 ** exponent).toFixed(1))} ${units[exponent]}`;
}

export function getStorageEndpoint(url: string): string {
  const endpoint = new URL(url);
  if (/^[a-z0-9-]+\.supabase\.co$/.test(endpoint.hostname)) {
    endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co');
  }
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/storage/v1/upload/resumable`;
  return endpoint.toString();
}

async function existingAttachment(path: string, id: string, file: File): Promise<boolean> {
  const folder = path.slice(0, path.lastIndexOf('/'));
  const { data, error } = await supabase.storage.from(bucket).list(folder, { search: id, limit: 1 });
  if (error) throw error;
  const existing = data.find(object => object.name === id);
  if (!existing) return false;
  const metadata = objectMetadataSchema.safeParse(existing.metadata);
  if (!metadata.success || metadata.data.size !== file.size ||
      (metadata.data.mimetype && metadata.data.mimetype !== mediaType(file))) {
    throw new AttachmentUploadError('Já existe um ficheiro diferente com este identificador.');
  }
  return true;
}

export async function uploadAttachment(input: UploadInput): Promise<Attachment> {
  const { file, signal, onProgress } = input;
  const path = idsSchema.parse([input.org, input.conversation, input.user, input.message, input.id]).join('/');
  if (!Number.isFinite(input.maxBytes) || input.maxBytes <= 0 || !file.size || file.size > input.maxBytes) {
    throw new AttachmentUploadError(`O ficheiro deve ter entre 1 byte e ${formatBytes(input.maxBytes)}.`);
  }
  signal?.throwIfAborted();
  const attachment: Attachment = {
    id: input.id, path, name: file.name.split(/[\\/]/).pop()?.replace(/\p{Cc}/gu, '').slice(0, 255) || 'Ficheiro',
    mime: mediaType(file), size: file.size,
  };
  if (await existingAttachment(path, input.id, file)) { signal?.throwIfAborted(); onProgress(100); return attachment; }
  signal?.throwIfAborted();
  return new Promise<Attachment>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error);
      else { onProgress(100); resolve(attachment); }
    };
    const upload = new Upload(file, {
      endpoint: getStorageEndpoint(import.meta.env.VITE_SUPABASE_URL),
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      fingerprint: async () => `messages:${path}:${file.size}:${file.lastModified}:${file.type}`,
      metadata: { bucketName: bucket, objectName: path, contentType: attachment.mime, cacheControl: '3600' },
      onBeforeRequest: async request => {
        signal?.throwIfAborted();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        signal?.throwIfAborted();
        if (!data.session) throw new AttachmentUploadError('Inicie sessão para enviar ficheiros.');
        request.setHeader('authorization', `Bearer ${data.session.access_token}`);
      },
      onProgress: (sent, total) => { if (!settled && total > 0) onProgress(Math.min(100, sent / total * 100)); },
      onSuccess: () => finish(),
      onError: error => {
        existingAttachment(path, input.id, file).then(exists => finish(exists ? undefined : error), finish);
      },
    });
    const cancel = () => {
      finish(new DOMException('Envio cancelado.', 'AbortError'));
      // Preserve a partial upload for a scoped retry; abort stops all active requests.
      void upload.abort().catch(error => { if (error instanceof Error) console.warn('Falha ao cancelar envio', error); });
    };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    upload.findPreviousUploads().then(previous => {
      if (settled) return;
      const matching = previous.find(item => item.metadata.objectName === path && item.metadata.bucketName === bucket && item.size === file.size);
      if (matching) upload.resumeFromPreviousUpload(matching);
      onProgress(0);
      upload.start();
    }).catch(finish);
  });
}
