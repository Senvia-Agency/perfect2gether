import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  certificateResponseSchema,
  certificateSchema,
  classifyCertificateInvocationError,
  CRC_PATTERN,
  type CertificateImportPhase,
  type ClientCertificate,
} from '@/lib/client-certificate';
import {
  clearCertificateRecoveries,
  clearCertificateRecovery,
  loadCertificateRecovery,
  saveCertificateRecovery,
  type BrowserStorage,
  type CertificateRecovery,
  type ClientFormScope,
} from '@/lib/client-form-persistence';

const POLL_DELAY_MS = 2_500;
const MAX_RETRY_DELAY_MS = 30_000;
const STORAGE_ERROR = 'O armazenamento local está indisponível. Não é possível iniciar a importação em segurança.';

type UseClientCertificateOptions = {
  readonly open: boolean;
  readonly crcCode: string;
  readonly scope: ClientFormScope | null;
  readonly onSuccess: (data: ClientCertificate, checkedAt: string) => void;
};

type CertificateUiState = {
  readonly pending: boolean;
  readonly phase: CertificateImportPhase | null;
  readonly startedAt: string | null;
  readonly error: string;
  readonly notice: string;
  readonly canResume: boolean;
  readonly storageUnavailable: boolean;
};

const INITIAL_STATE: CertificateUiState = {
  pending: false,
  phase: null,
  startedAt: null,
  error: '',
  notice: '',
  canResume: false,
  storageUnavailable: false,
};

function getBrowserStorage(): BrowserStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch (error) {
    if (error instanceof Error) return null;
    return null;
  }
}

function retryDelay(attempt: number): number {
  return Math.min(POLL_DELAY_MS * (2 ** Math.min(attempt, 4)), MAX_RETRY_DELAY_MS);
}

export function useClientCertificate(options: UseClientCertificateOptions) {
  const { open, crcCode, scope, onSuccess } = options;
  const normalizedCrc = crcCode.trim();
  const userId = scope?.userId;
  const organizationId = scope?.organizationId;
  const formContext = scope?.formContext;
  const scopeKey = `${userId ?? ''}:${organizationId ?? ''}:${formContext ?? ''}`;
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const inFlight = useRef(false);
  const retryAttempt = useRef(0);
  const recovery = useRef<CertificateRecovery | null>(null);
  const openRef = useRef(open);
  const onSuccessRef = useRef(onSuccess);
  const invokeRef = useRef<(record: CertificateRecovery, request: number) => Promise<void>>(async () => undefined);
  const [state, setState] = useState<CertificateUiState>(INITIAL_STATE);
  const [elapsedMs, setElapsedMs] = useState(0);

  onSuccessRef.current = onSuccess;
  openRef.current = open;

  const activeScope = (): ClientFormScope | null => {
    if (!userId || !organizationId || !formContext) return null;
    return { userId, organizationId, formContext };
  };

  const clearTimer = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };

  const setPaused = (record: CertificateRecovery, message: string, storageUnavailable = false) => {
    inFlight.current = false;
    clearTimer();
    setState({
      pending: false,
      phase: record.phase,
      startedAt: record.startedAt,
      error: message,
      notice: '',
      canResume: true,
      storageUnavailable,
    });
  };

  const schedule = (record: CertificateRecovery, request: number, delay: number) => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void invokeRef.current(record, request);
    }, delay);
  };

  const handleTransportError = (record: CertificateRecovery, request: number, value: unknown) => {
    inFlight.current = false;
    const kind = classifyCertificateInvocationError(value);
    switch (kind) {
      case 'AUTH':
        setPaused(record, 'A importação ficou em pausa porque a sessão expirou. Inicie sessão novamente e retome a consulta.');
        return;
      case 'TRANSIENT': {
        const delay = retryDelay(retryAttempt.current);
        retryAttempt.current += 1;
        setState({
          pending: true,
          phase: record.phase,
          startedAt: record.startedAt,
          error: '',
          notice: 'Ligação interrompida. A importação continua no servidor e será retomada automaticamente.',
          canResume: false,
          storageUnavailable: false,
        });
        schedule(record, request, delay);
        return;
      }
      case 'UNKNOWN':
        setPaused(record, 'Não foi possível confirmar o estado da importação. Retome para consultar o mesmo pedido, sem iniciar outro.');
        return;
    }
  };

  const invokeRecovery = async (record: CertificateRecovery, request: number): Promise<void> => {
    const currentScope = userId && organizationId && formContext
      ? { userId, organizationId, formContext }
      : null;
    if (!currentScope || request !== generation.current || record.crcCode !== normalizedCrc || inFlight.current) return;
    inFlight.current = true;
    clearTimer();
    try {
      const body = record.runId
        ? { action: 'status', organizationId: currentScope.organizationId, runId: record.runId }
        : {
          action: 'start',
          organizationId: currentScope.organizationId,
          crcCode: record.crcCode,
          requestId: record.requestId,
        };
      const { data, error: invocationError } = await supabase.functions.invoke('lookup-client-certificate', { body });
      if (request !== generation.current || record.crcCode !== normalizedCrc) return;
      inFlight.current = false;
      if (invocationError) {
        handleTransportError(record, request, invocationError);
        return;
      }
      const parsed = certificateResponseSchema.safeParse(data);
      if (!parsed.success) {
        setPaused(record, 'A resposta da importação foi inesperada. Retome para consultar o mesmo pedido, sem iniciar outro.');
        return;
      }
      switch (parsed.data.status) {
        case 'RUNNING': {
          retryAttempt.current = 0;
          const next: CertificateRecovery = {
            requestId: record.requestId,
            crcCode: record.crcCode,
            runId: parsed.data.runId,
            startedAt: parsed.data.startedAt,
            phase: parsed.data.phase,
          };
          recovery.current = next;
          const storage = getBrowserStorage();
          const saved = storage
            ? saveCertificateRecovery(storage, currentScope, next)
            : { kind: 'unavailable' as const, message: STORAGE_ERROR };
          setState({
            pending: true,
            phase: next.phase,
            startedAt: next.startedAt,
            error: '',
            notice: saved.kind === 'unavailable' ? saved.message : '',
            canResume: false,
            storageUnavailable: saved.kind === 'unavailable',
          });
          schedule(next, request, POLL_DELAY_MS);
          return;
        }
        case 'SUCCEEDED': {
          const certificate = certificateSchema.safeParse(parsed.data.data);
          if (!certificate.success) {
            setPaused(record, 'A certidão não devolveu dados completos. Retome para consultar o mesmo pedido.');
            return;
          }
          if (!openRef.current) {
            setState({
              pending: false,
              phase: record.phase,
              startedAt: record.startedAt,
              error: '',
              notice: 'Importação concluída. Reabra o formulário para aplicar os dados guardados.',
              canResume: true,
              storageUnavailable: false,
            });
            return;
          }
          recovery.current = null;
          const storage = getBrowserStorage();
          const cleared = storage
            ? clearCertificateRecovery(storage, currentScope, record.crcCode)
            : { kind: 'unavailable' as const, message: STORAGE_ERROR };
          setState({
            pending: false,
            phase: null,
            startedAt: null,
            error: cleared.kind === 'unavailable' ? cleared.message : '',
            notice: '',
            canResume: false,
            storageUnavailable: cleared.kind === 'unavailable',
          });
          onSuccessRef.current(certificate.data, parsed.data.checkedAt);
          return;
        }
        case 'FAILED': {
          recovery.current = null;
          const storage = getBrowserStorage();
          if (storage) clearCertificateRecovery(storage, currentScope, record.crcCode);
          setState({ ...INITIAL_STATE, error: parsed.data.error });
          return;
        }
      }
    } catch (error) {
      if (request !== generation.current || record.crcCode !== normalizedCrc) return;
      inFlight.current = false;
      handleTransportError(record, request, error);
    }
  };
  invokeRef.current = invokeRecovery;

  useEffect(() => {
    const request = ++generation.current;
    clearTimer();
    inFlight.current = false;
    retryAttempt.current = 0;
    recovery.current = null;
    setState(INITIAL_STATE);
    const currentScope = userId && organizationId && formContext
      ? { userId, organizationId, formContext }
      : null;
    if (!currentScope || !CRC_PATTERN.test(normalizedCrc)) return;
    const storage = getBrowserStorage();
    if (!storage) {
      setState({ ...INITIAL_STATE, error: STORAGE_ERROR, storageUnavailable: true });
      return;
    }
    const stored = loadCertificateRecovery(storage, currentScope, normalizedCrc);
    if (stored.kind === 'unavailable') {
      setState({ ...INITIAL_STATE, error: stored.message, storageUnavailable: true });
      return;
    }
    if (!stored.value) return;
    recovery.current = stored.value;
    setState({
      pending: true,
      phase: stored.value.phase,
      startedAt: stored.value.startedAt,
      error: '',
      notice: 'Importação recuperada. A consultar o estado guardado.',
      canResume: false,
      storageUnavailable: false,
    });
    if (openRef.current) void invokeRef.current(stored.value, request);
  }, [userId, organizationId, formContext, normalizedCrc]);

  useEffect(() => {
    if (!open || !recovery.current || inFlight.current || timer.current) return;
    void invokeRef.current(recovery.current, generation.current);
  }, [open, scopeKey, normalizedCrc]);

  useEffect(() => {
    if (!state.startedAt) {
      setElapsedMs(0);
      return;
    }
    const update = () => setElapsedMs(Math.max(0, Date.now() - Date.parse(state.startedAt ?? '')));
    update();
    if (!state.pending) return;
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [state.pending, state.startedAt]);

  useEffect(() => () => {
    generation.current += 1;
    inFlight.current = false;
    clearTimer();
  }, []);

  const lookup = async (): Promise<void> => {
    if (!open || inFlight.current || timer.current || !CRC_PATTERN.test(normalizedCrc)) return;
    const currentScope = activeScope();
    if (!currentScope) return;
    const storage = getBrowserStorage();
    if (!storage) {
      setState({ ...INITIAL_STATE, error: STORAGE_ERROR, storageUnavailable: true });
      return;
    }
    const stored = loadCertificateRecovery(storage, currentScope, normalizedCrc);
    if (stored.kind === 'unavailable') {
      setState({ ...INITIAL_STATE, error: stored.message, storageUnavailable: true });
      return;
    }
    let record = stored.value;
    if (!record) {
      record = {
        requestId: crypto.randomUUID(),
        crcCode: normalizedCrc,
        startedAt: new Date().toISOString(),
        phase: 'QUEUED',
      };
      const saved = saveCertificateRecovery(storage, currentScope, record);
      if (saved.kind === 'unavailable') {
        setState({ ...INITIAL_STATE, error: saved.message, storageUnavailable: true });
        return;
      }
    }
    recovery.current = record;
    retryAttempt.current = 0;
    setState({
      pending: true,
      phase: record.phase,
      startedAt: record.startedAt,
      error: '',
      notice: '',
      canResume: false,
      storageUnavailable: false,
    });
    await invokeRecovery(record, generation.current);
  };

  const clearRecovery = () => {
    generation.current += 1;
    inFlight.current = false;
    clearTimer();
    recovery.current = null;
    const currentScope = activeScope();
    const storage = getBrowserStorage();
    if (!currentScope || !storage) {
      setState(currentScope ? { ...INITIAL_STATE, error: STORAGE_ERROR, storageUnavailable: true } : INITIAL_STATE);
      return;
    }
    const cleared = clearCertificateRecoveries(storage, currentScope);
    setState(cleared.kind === 'unavailable'
      ? { ...INITIAL_STATE, error: cleared.message, storageUnavailable: true }
      : INITIAL_STATE);
  };

  return { ...state, elapsedMs, lookup, clearRecovery };
}
