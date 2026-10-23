import { useEffect, useRef, useState } from 'react';
import { clearClientFormDraft, loadClientFormDraft, saveClientFormDraft } from '@/lib/client-form-persistence';
import type { ClientFormDraft, ClientFormScope } from '@/lib/client-form-persistence';

type Options = {
  readonly open: boolean;
  readonly scope: ClientFormScope | null;
  readonly value: ClientFormDraft;
  readonly onRestore: (value: ClientFormDraft) => void;
  readonly onInitialize: () => void;
};
const storageError = 'Não foi possível guardar o rascunho neste navegador. Mantenha a ficha aberta até guardar.';

export function useClientFormDraft(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState('');
  const skipInitial = useRef(false);
  const baseline = useRef<string | null>(null);
  const { open, scope, value } = options;
  const key = scope ? `${scope.userId}:${scope.organizationId}:${scope.formContext}` : '';

  useEffect(() => {
    if (!open) { setHydratedKey(null); return; }
    const current = latest.current;
    setRestored(false);
    setError('');
    baseline.current = null;
    skipInitial.current = false;
    if (!current.scope) { current.onInitialize(); return; }
    try {
      const loaded = loadClientFormDraft(window.localStorage, current.scope);
      if (loaded.kind === 'unavailable') {
        setError(loaded.message);
        current.onInitialize();
      } else if (loaded.value) {
        current.onRestore(loaded.value);
        setRestored(true);
      } else {
        skipInitial.current = true;
        current.onInitialize();
      }
    } catch (cause) {
      if (cause instanceof Error) setError(storageError);
      else setError(storageError);
      current.onInitialize();
    }
    setHydratedKey(key);
  }, [open, key]);

  useEffect(() => {
    if (!open || !scope || hydratedKey !== key) return;
    const serialized = JSON.stringify(value);
    if (skipInitial.current) {
      skipInitial.current = false;
      baseline.current = serialized;
      return;
    }
    try {
      const result = serialized === baseline.current
        ? clearClientFormDraft(window.localStorage, scope)
        : saveClientFormDraft(window.localStorage, scope, value);
      setError(result.kind === 'unavailable' ? result.message : '');
    } catch (cause) {
      if (cause instanceof Error) setError(storageError);
      else setError(storageError);
    }
  }, [open, key, scope, value, hydratedKey]);

  const clear = () => {
    setHydratedKey(null);
    setRestored(false);
    const currentScope = latest.current.scope;
    if (!currentScope) return;
    try {
      const result = clearClientFormDraft(window.localStorage, currentScope);
      setError(result.kind === 'unavailable' ? result.message : '');
    } catch (cause) {
      if (cause instanceof Error) setError(storageError);
      else setError(storageError);
    }
  };
  const discard = () => {
    clear();
    skipInitial.current = true;
    baseline.current = null;
    latest.current.onInitialize();
    setHydratedKey(key);
  };
  return { ready: !scope || hydratedKey === key, restored, error, clear, discard };
}
