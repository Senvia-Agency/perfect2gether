import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ClockApiError, clockApi } from './api';
import { getBestPosition, warmupGeolocation } from './geolocation';
import { currentMonth, getClockState, summarizeMonth } from './workday';
import type { Action, Entry, PunchInput, PunchOptions, Snapshot } from './types';
const flights = new Set<string>();
function deviceId(): string {
  const key = 'p2g-clock-device', stored = localStorage.getItem(key);
  if (stored) return stored;
  const id = crypto.randomUUID(); localStorage.setItem(key, id); return id;
}
function provisional(input: PunchInput, userId: string, nowMs: number): Entry {
  const at = input.at ?? new Date(nowMs).toISOString();
  return { id: input.request_id, organization_id: input.org, user_id: userId,
    entry_type: input.action === 'start' || input.action === 'resume' ? 'in' : 'out',
    kind: input.action === 'pause' ? 'pause' : 'work', action: input.action,
    punched_at: at, created_at: new Date().toISOString(), status: 'pending', flags: input.at ? ['manual_time'] : [], note: input.note ?? '',
    location_id: null, location_name: null, address: null, distance_m: null, source: input.tag ? 'nfc' : 'gps', corrected: !!input.at };
}
export function useTimeClock(month?: string, selectedUser?: string, tickMs = 30000) {
  const { user, organization } = useAuth(), queryClient = useQueryClient();
  const { features } = useReleaseFeatures();
  const userId = user?.id, organizationId = organization?.id;
  const owner = `${organizationId}:${userId}`, ownerRef = useRef(owner); ownerRef.current = owner;
  const [now, setNow] = useState(Date.now()), [phase, setPhase] = useState<'idle' | 'locating' | 'sending'>('idle');
  const [punchError, setPunchError] = useState<Error | null>(null), [canRetry, setCanRetry] = useState(false);
  const serverOffset = useRef(0), lastServerTime = useRef<string | null>(null);
  const retryInput = useRef<{ readonly owner: string; readonly input: PunchInput } | null>(null);
  const liveMonth = currentMonth(now), selectedMonth = month ?? liveMonth;
  const currentKey = useMemo(() => ['timeclock', organizationId, userId, liveMonth, userId] as const, [organizationId, userId, liveMonth]);
  const selectedKey = ['timeclock', organizationId, userId, selectedMonth, month ? selectedUser : userId] as const;
  const enabled = features.timeclock && !!userId && !!organizationId;
  const current = useQuery({ queryKey: currentKey, enabled, queryFn: () => clockApi.snapshot(organizationId ?? '', liveMonth, userId), staleTime: 15000, refetchInterval: 60000 });
  const selected = useQuery({ queryKey: selectedKey, enabled, queryFn: () => clockApi.snapshot(organizationId ?? '', selectedMonth, month ? selectedUser : userId), staleTime: 15000 });
  useEffect(() => {
    const tick = () => setNow(Date.now() + serverOffset.current);
    const timer = window.setInterval(tick, tickMs);
    window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [tickMs]);
  useEffect(() => {
    if (!current.data || lastServerTime.current === owner + current.data.server_now) return;
    lastServerTime.current = owner + current.data.server_now;
    const server = Date.parse(current.data.server_now);
    if (Number.isFinite(server) && current.dataUpdatedAt) { serverOffset.current = server - current.dataUpdatedAt; setNow(Date.now() + serverOffset.current); }
  }, [current.data, current.dataUpdatedAt, owner]);
  useEffect(() => { setPunchError(null); setPhase('idle'); setCanRetry(false); retryInput.current = null; }, [owner]);
  const refresh = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: ['timeclock', organizationId, userId] }); }, [queryClient, organizationId, userId]);
  const perform = useCallback(async (action: Action, options: PunchOptions = {}, retry = false) => {
    if (!features.timeclock) throw new ClockApiError('disabled', 'O ponto está desativado.');
    if (!organizationId || !userId) throw new ClockApiError('auth', 'Sessão indisponível.');
    if (flights.has(owner)) throw new ClockApiError('busy', 'Já existe um registo a ser enviado.');
    flights.add(owner); setPunchError(null); setCanRetry(false);
    let input: PunchInput | undefined;
    let previous: Snapshot | undefined;
    try {
      const saved = retryInput.current;
      if (retry && saved?.owner === owner) input = saved.input;
      else {
        setPhase('locating');
        input = { ...options, org: organizationId, request_id: crypto.randomUUID(), action, position: await getBestPosition(), device_id: deviceId() };
      }
      if (ownerRef.current !== owner) throw new ClockApiError('identity_changed', 'A sessão mudou. Volte a registar com a sessão atual.');
      retryInput.current = { owner, input };
      setPhase('sending');
      await queryClient.cancelQueries({ queryKey: currentKey });
      previous = queryClient.getQueryData<Snapshot>(currentKey);
      const optimisticNow = Date.now() + serverOffset.current;
      const optimistic = provisional(input, userId, optimisticNow);
      setNow(optimisticNow);
      queryClient.setQueryData<Snapshot>(currentKey, old => {
        if (!old) return old;
        const last = old.entries.filter(entry => entry.user_id === userId && entry.status !== 'voided').sort((a, b) => Date.parse(a.punched_at) - Date.parse(b.punched_at)).at(-1);
        const entries = old.entries.map(entry => input?.action === 'resume' && last?.action === 'stop' && entry.id === last.id ? { ...entry, action: 'pause' as const, kind: 'pause' as const, corrected: true } : entry);
        return { ...old, entries: [...entries, optimistic] };
      });
      const result = await clockApi.punch(input);
      if (retryInput.current?.owner === owner) retryInput.current = null;
      await refresh();
      return result;
    } catch (error: unknown) {
      if (previous) queryClient.setQueryData(currentKey, previous);
      const failure = error instanceof Error ? error : new ClockApiError('unknown', 'Não foi possível registar.');
      const retryable = failure instanceof ClockApiError && failure.retryable;
      if (!retryable && retryInput.current?.owner === owner) retryInput.current = null;
      if (ownerRef.current === owner) { setPunchError(failure); setCanRetry(retryable); }
      throw failure;
    } finally { flights.delete(owner); if (ownerRef.current === owner) setPhase('idle'); }
  }, [features.timeclock, organizationId, userId, owner, queryClient, currentKey, refresh]);
  const punch = useCallback((action: Action, options?: PunchOptions) => perform(action, options), [perform]);
  const retry = useCallback(() => {
    const saved = retryInput.current;
    if (!saved || saved.owner !== owner) return Promise.reject(new ClockApiError('no_retry', 'Não existe um registo para repetir.'));
    return perform(saved.input.action, saved.input, true);
  }, [owner, perform]);
  const ownEntries = useMemo(() => current.data?.entries.filter(entry => entry.user_id === userId) ?? [], [current.data, userId]);
  const state = useMemo(() => getClockState(ownEntries, now), [ownEntries, now]);
  const summary = useMemo(() => summarizeMonth(selected.data?.entries.filter(entry => entry.user_id === (selectedUser ?? userId)) ?? [], selectedMonth, 'Europe/Lisbon', now, selected.data?.holidays), [selected.data, selectedUser, userId, selectedMonth, now]);
  return { userId, organizationId, snapshot: selected.data, currentSnapshot: current.data, state, summary, now,
    isLoading: selected.isLoading, error: punchError ?? selected.error ?? current.error, phase, canRetry, punch, retry, refresh, warmup: warmupGeolocation };
}







