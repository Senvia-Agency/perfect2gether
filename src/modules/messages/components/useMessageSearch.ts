import { useEffect, useRef, useState } from 'react';
import type { MessagesController } from '../useMessages';
import type { SearchResult } from '../types';

type SearchState = { readonly key: string; readonly results: SearchResult[]; readonly error: string; readonly pending: boolean };

export function useMessageSearch(controller: MessagesController) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SearchState | null>(null);
  const request = useRef(0);
  const searchApi = useRef(controller.search);
  searchApi.current = controller.search;
  const version = (controller.snapshot?.conversations ?? []).map(item => `${item.id}:${item.updated_at}`).sort().join('|');
  const key = JSON.stringify([controller.orgId, controller.userId, submitted, version, revision]);
  useEffect(() => {
    if (!submitted) return;
    const token = ++request.current;
    let active = true;
    setState({ key, results: [], error: '', pending: true });
    void searchApi.current(submitted).then(results => {
      if (active && token === request.current) setState({ key, results, error: '', pending: false });
    }).catch((failure: unknown) => {
      if (active && token === request.current) setState({ key, results: [], error: failure instanceof Error ? failure.message : 'Pesquisa indisponível.', pending: false });
    });
    return () => { active = false; };
  }, [key, submitted]);
  function cancel() { request.current += 1; setSubmitted(null); setState(null); }
  function changeQuery(value: string) { cancel(); setQuery(value); }
  function search() { request.current += 1; setSubmitted(query.trim() || null); setRevision(current => current + 1); }
  const current = state?.key === key ? state : null;
  return { query, changeQuery, search, cancel, results: submitted ? current?.results ?? [] : null, searching: Boolean(submitted && (!current || current.pending)), error: current?.error ?? '' };
}
