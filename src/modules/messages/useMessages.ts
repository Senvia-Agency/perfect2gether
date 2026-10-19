import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { chatAction, messagesApi, MessagingError, forwardMessage, createForwardAttempt } from './api';
import { uploadAttachment } from './uploads';
import type { ForwardAttempt } from './api';
import type { Attachment, CreateInput, ManageInput, Message, SearchResult } from './types';

export function useMessages() {
  const { user, organization } = useAuth();
  const userId = user?.id ?? '', orgId = organization?.id ?? '';
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('conversation');
  const around = params.get('message');
  const aroundRef = useRef(around); aroundRef.current = around;
  const focusedTarget = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const savedQuery = useQuery({ queryKey: ['messages-saved', orgId, userId], queryFn: () => messagesApi.saved(orgId), enabled: showSaved && !!orgId && !!userId, retry: false, refetchInterval: 5000 });
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadError, setThreadError] = useState<Error | null>(null);
  const currentId = useRef(selectedId);
  currentId.current = selectedId;
  const contextScope = `${orgId}:${userId}:${selectedId}:${around}`;
  const scopeRef = useRef(contextScope); scopeRef.current = contextScope;
  const previousOrg = useRef(orgId);

  const typingAt = useRef(0);
  const sending = useRef(false);
  const forwards = useRef(new Map<string, ForwardAttempt>());
  const draft = useRef<{ id: string; conversation: string; body: string; files: File[]; ids: string[]; uploaded: Attachment[] } | null>(null);
  const key = ['messages-snapshot', orgId, userId];
  const query = useQuery({ queryKey: key, queryFn: () => messagesApi.snapshot(orgId), enabled: !!orgId && !!userId, retry: false, refetchInterval: selectedId ? 5000 : 30000 });
  const reload = useCallback(() => { void queryClient.invalidateQueries({ queryKey: ['messages-snapshot', orgId, userId] }); }, [queryClient, orgId, userId]);
  const select = useCallback((id: string | null) => { setParams(id ? { conversation: id } : {}); }, [setParams]);
  useEffect(() => { if (previousOrg.current !== orgId) { previousOrg.current = orgId; draft.current = null; forwards.current.clear(); setShowSaved(false); select(null); } }, [orgId, select]);
  const refresh = useCallback(async (id: string) => {
    const scope = scopeRef.current;
    const data = await messagesApi.history(id, aroundRef.current ? { around: aroundRef.current } : {});
    if (currentId.current !== id || scopeRef.current !== scope) return;
    setMessages(data); setHasOlder(data.length === 60); setThreadError(null);
  }, []);
  useEffect(() => {
    setMessages([]); setHasOlder(false); setThreadError(null);
    if (!selectedId) return;
    let active = true;
    setLoadingMessages(true);
    void refresh(selectedId).catch((error: unknown) => { if (active) setThreadError(error instanceof Error ? error : new MessagingError('load', 'Não foi possível carregar a conversa.')); })
      .finally(() => { if (active) setLoadingMessages(false); });
    return () => { active = false; };
  }, [selectedId, orgId, around, refresh]);
  useEffect(() => {
    if (!selectedId || !messages.length || around) return;
    const mark = () => { if (document.visibilityState === 'visible') void chatAction('read', { conversation: selectedId }).then(reload).catch((error: unknown) => setThreadError(error instanceof Error ? error : new MessagingError('read', 'Falha ao confirmar a leitura.'))); };
    mark(); document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [selectedId, messages[messages.length - 1]?.id, reload, around]);
  useEffect(() => {
    if (!selectedId) return;
    const update = () => { if (document.visibilityState === 'visible') void chatAction('presence', { conversation: selectedId }).catch((error: unknown) => setThreadError(error instanceof Error ? error : new MessagingError('presence', 'Ligação interrompida.'))); };
    update(); const timer = window.setInterval(update, 45000);
    return () => window.clearInterval(timer);
  }, [selectedId]);
  useEffect(() => {
    if (!orgId || !userId) return;
    // Postgres Changes applies table RLS to every subscriber; no public Broadcast/Presence channels.
    const channel = supabase.channel(`messages:${orgId}:${userId}`);
    const changed = () => { reload(); void queryClient.invalidateQueries({ queryKey: ['messages-saved', orgId, userId] }); const id = currentId.current; if (id) void refresh(id).catch((error: unknown) => setThreadError(error instanceof Error ? error : new MessagingError('realtime', 'Atualização interrompida.'))); };
    for (const table of ['p2g_chat_messages', 'p2g_chat_conversations']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed);
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orgId, userId, reload, refresh, queryClient]);
  const changed = async (action: string, payload: Parameters<typeof chatAction>[1]) => {
    await chatAction(action, payload); void queryClient.invalidateQueries({ queryKey: ['messages-saved', orgId, userId] }); reload(); if (selectedId) await refresh(selectedId);
  };
  const loadOlder = async () => {
    const first = messages[0]; if (!selectedId || !first) return;
    const id = selectedId, data = await messagesApi.history(id, { before: first.created_at });
    if (currentId.current === id) { setMessages(previous => [...data, ...previous.filter(m => !data.some(n => n.id === m.id))]); setHasOlder(data.length === 60); }
  };
  const send = async (body: string, files: File[], replyTo: string | null, onProgress: (value: number) => void, signal?: AbortSignal) => {
    if (!selectedId || !query.data) throw new MessagingError('unavailable', 'Abra uma conversa antes de enviar.');
    if (sending.current) throw new MessagingError('busy', 'Aguarde a conclusão do envio anterior. O rascunho foi mantido.');
    if (!body.trim() && !files.length) throw new MessagingError('empty', 'Escreva uma mensagem ou adicione um ficheiro.');
    if (body.length > 4000) throw new MessagingError('length', 'A mensagem pode ter até 4000 caracteres.');
    sending.current = true;
    try {
      if (!draft.current || draft.current.conversation !== selectedId || draft.current.body !== body || draft.current.files.length !== files.length || files.some((file, i) => file !== draft.current?.files[i])) {
        draft.current = { id: crypto.randomUUID(), conversation: selectedId, body, files, ids: files.map(() => crypto.randomUUID()), uploaded: [] };
      }
      const pending = draft.current;
      for (let i = pending.uploaded.length; i < files.length; i++) {
        pending.uploaded.push(await uploadAttachment({ file: files[i], id: pending.ids[i], org: orgId, conversation: selectedId, user: userId, message: pending.id, maxBytes: query.data.max_file_bytes,
          onProgress: p => onProgress((i + p / 100) / files.length * 100), signal }));
      }
      signal?.throwIfAborted();
      const sent = await messagesApi.send({ id: pending.id, conversation: selectedId, body, reply_to: replyTo, attachments: pending.uploaded });
      if (currentId.current === selectedId) setMessages(previous => [...previous.filter(m => m.id !== sent.id), sent]);
      draft.current = null; reload();
    } finally { sending.current = false; }
  };
  const jump = async (result: SearchResult) => { setParams({ conversation: result.conversation_id, message: result.message_id }); };
  useEffect(() => { if (!around) { focusedTarget.current = null; return; } if (loadingMessages || focusedTarget.current === contextScope) return; const target = document.getElementById(`message-${around}`); if (target) { target.scrollIntoView({ block: 'center' }); target.focus({ preventScroll: true }); focusedTarget.current = contextScope; } }, [around, messages, loadingMessages, contextScope]);
  return {
    userId, orgId, snapshot: query.data, viewingHistory: !!around, isLoading: query.isLoading, error: threadError ?? query.error, reload, selectedId, select, messages, hasOlder, loadOlder, loadingMessages, send,
    edit: (id: string, body: string) => changed('edit', { message: id, body }),
    remove: (id: string) => changed('delete', { message: id }),
    react: (id: string, emoji: string) => changed('react', { message: id, emoji }),
    save: (id: string, value: boolean) => changed('save', { message: id, saved: value }),
    pinMessage: (id: string, value: boolean) => changed('pin_message', { message: id, pinned: value }),
    saved: (savedQuery.data ?? []).filter(message => query.data?.conversations.some(item => item.id === message.conversation_id)),
    loadSaved: async () => { setShowSaved(true); await queryClient.fetchQuery({ queryKey: ['messages-saved', orgId, userId], queryFn: () => messagesApi.saved(orgId) }); },
    preferences: (id: string, patch: { pinned?: boolean; muted?: boolean; archived?: boolean }) => changed('preferences', { conversation: id, ...patch }),
    create: async (input: CreateInput) => { const id = await messagesApi.create(input); reload(); select(id); return id; },
    manage: async (input: ManageInput) => { await messagesApi.manage(input); reload(); if (input.op === 'leave') select(null); },
    search: (text: string) => messagesApi.search(orgId, text), jump,
    typing: () => { if (selectedId && Date.now() - typingAt.current > 3000) { typingAt.current = Date.now(); void chatAction('typing', { conversation: selectedId }).catch((error: unknown) => setThreadError(error instanceof Error ? error : new MessagingError('typing', 'Ligação interrompida.'))); } },
    forward: async (message: Message, target: string) => {
      const key = `${orgId}:${userId}:${target}:${message.id}`;
      const attempt = forwards.current.get(key) ?? createForwardAttempt(message);
      forwards.current.set(key, attempt);
      await forwardMessage(message, target, orgId, userId, attempt);
      forwards.current.delete(key); reload(); if (target === selectedId) await refresh(target);
    },
  };
}
export type MessagesController = ReturnType<typeof useMessages>;
