import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Draft = { readonly body: string; readonly files: File[]; readonly reply: string | null };
type DraftStore = { readonly drafts: ReadonlyMap<string, Draft>; readonly update: (id: string, patch: Partial<Draft>) => void; readonly clear: (id: string) => void };
const emptyDraft: Draft = { body: '', files: [], reply: null };
const Context = createContext<DraftStore | null>(null);

export function MessageDrafts({ children, conversations }: { readonly children: ReactNode; readonly conversations: readonly string[] }) {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Draft>>(new Map());
  const update = useCallback((id: string, patch: Partial<Draft>) => setDrafts(current => new Map(current).set(id, { ...(current.get(id) ?? emptyDraft), ...patch })), []);
  const clear = useCallback((id: string) => setDrafts(current => { const next = new Map(current); next.delete(id); return next; }), []);
  useEffect(() => { setDrafts(current => { const removed = Array.from(current.keys()).filter(id => !conversations.includes(id)); if (!removed.length) return current; const next = new Map(current); removed.forEach(id => next.delete(id)); return next; }); }, [conversations]);
  return <Context.Provider value={{ drafts, update, clear }}>{children}</Context.Provider>;
}

export function useMessageDraft(id: string) {
  const store = useContext(Context);
  if (!store) throw new Error('MessageDrafts provider required');
  return { draft: store.drafts.get(id) ?? emptyDraft, update: (patch: Partial<Draft>) => store.update(id, patch), clear: () => store.clear(id) };
}
