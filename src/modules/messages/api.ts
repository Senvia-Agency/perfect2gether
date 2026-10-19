import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { snapshotSchema, messageSchema, searchResultSchema } from './types';
import type { CreateInput, SendInput, ManageInput, Message, Attachment } from './types';

export class MessagingError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'MessagingError'; }
}
export async function chatAction(action: string, payload: Json) {
  const { data, error } = await supabase.rpc('p2g_chat', { action, payload });
  if (error) {
    const unavailable = ['PGRST202', '42883', '42P01'].includes(error.code);
    throw new MessagingError(error.code, unavailable
      ? 'O módulo de mensagens ainda não está instalado nesta base de dados.'
      : error.message);
  }
  return data;
}
export const messagesApi = {
  snapshot: async (org: string) => snapshotSchema.parse(await chatAction('snapshot', { org })),
  history: async (conversation: string, options: { before?: string; around?: string } = {}) =>
    z.array(messageSchema).parse(await chatAction('history', { conversation, ...options })),
  search: async (org: string, query: string) => z.array(searchResultSchema).parse(await chatAction('search', { org, query })),
  saved: async (org: string) => z.array(messageSchema).parse(await chatAction('saved', { org })),
  create: async (input: CreateInput) => z.string().uuid().parse(await chatAction('create', input)),
  send: async (input: SendInput) => messageSchema.parse(await chatAction('send', input)),
  manage: async (input: ManageInput) => { await chatAction('manage', input); },
};
export async function getAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from('p2g-chat-files').createSignedUrl(path, 60);
  if (error) throw new MessagingError('attachment_access', 'Não foi possível abrir o ficheiro. Confirme o acesso à conversa.');
  return data.signedUrl;
}
export { formatBytes } from './uploads';

export type ForwardAttempt = { readonly id: string; readonly fileIds: readonly string[]; readonly attachments: Attachment[] };
export function createForwardAttempt(message: Message): ForwardAttempt {
  return { id: crypto.randomUUID(), fileIds: message.attachments.map(() => crypto.randomUUID()), attachments: [] };
}
export async function forwardMessage(message: Message, conversation: string, org: string, user: string, attempt: ForwardAttempt) {
  for (let index = attempt.attachments.length; index < message.attachments.length; index++) {
    const original = message.attachments[index], fileId = attempt.fileIds[index];
    if (!original || !fileId) throw new MessagingError('forward_state', 'Volte a abrir o encaminhamento.');
    const folder = `${org}/${conversation}/${user}/${attempt.id}`, path = `${folder}/${fileId}`;
    const bucket = supabase.storage.from('p2g-chat-files');
    const listed = await bucket.list(folder, { search: fileId, limit: 1 });
    if (listed.error) throw new MessagingError('forward_copy', 'Não foi possível verificar o anexo. Tente novamente.');
    const existing = listed.data.find(object => object.name === fileId);
    if (existing) {
      const metadata = z.object({ size: z.number() }).safeParse(existing.metadata);
      if (!metadata.success || metadata.data.size !== original.size) throw new MessagingError('forward_copy', 'O anexo copiado não corresponde ao original.');
    } else {
      const { error } = await bucket.copy(original.path, path);
      if (error) throw new MessagingError('forward_copy', 'Não foi possível copiar o anexo. Tente novamente.');
    }
    attempt.attachments.push({ ...original, id: fileId, path });
  }
  return messagesApi.send({ id: attempt.id, conversation, body: message.body, reply_to: null, attachments: attempt.attachments, forwarded: true });
}
