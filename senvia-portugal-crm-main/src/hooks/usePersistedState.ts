import { useState, useEffect, useCallback } from 'react';

/**
 * Like useState but persists the value in localStorage.
 * Handles Date objects inside values (serialises as ISO strings, rehydrates on read).
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return rehydrate(JSON.parse(raw)) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      // Don't persist if it equals the default (keep localStorage clean)
      localStorage.setItem(key, JSON.stringify(state));
    } catch { }
  }, [key, state]);

  return [state, setState];
}

/**
 * Walk an object and convert any string that looks like an ISO date back into a Date.
 */
function rehydrate(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && isIsoDate(value)) return new Date(value);
  if (Array.isArray(value)) return value.map(rehydrate);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = rehydrate(v);
    }
    return result;
  }
  return value;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function isIsoDate(s: string): boolean {
  return ISO_RE.test(s) && !isNaN(Date.parse(s));
}

/**
 * Clear a persisted filter from localStorage (useful for "clear filters" buttons).
 */
export function clearPersistedState(key: string) {
  try {
    localStorage.removeItem(key);
  } catch { }
}
