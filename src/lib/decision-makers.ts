import type { Json } from '@/integrations/supabase/types';

export type DecisionMaker = { name: string; role: string; phone: string; email: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyDecisionMaker(): DecisionMaker {
  return { name: '', role: '', phone: '', email: '' };
}

function text(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function parseDecisionMakers(value: Json | null | undefined, legacyName?: string | null): DecisionMaker[] {
  const list = Array.isArray(value) ? value : [];
  const parsed = list.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    return [{ name: text(item.name), role: text(item.role), phone: text(item.phone), email: text(item.email) }];
  });
  if (parsed.length === 0 && legacyName?.trim()) return [{ ...emptyDecisionMaker(), name: legacyName.trim() }];
  return parsed;
}

export function isDecisionMakerEmailValid(email: string): boolean {
  return !email.trim() || EMAIL_PATTERN.test(email.trim());
}

export function areDecisionMakersValid(list: DecisionMaker[]): boolean {
  return list.length > 0 && list.every(item => item.name.trim() && isDecisionMakerEmailValid(item.email));
}

export function decisionMakersPayload(list: DecisionMaker[]): { decision_makers: DecisionMaker[]; decision_maker_name: string } {
  const decisionMakers = list.map(item => ({ name: item.name.trim(), role: item.role.trim(), phone: item.phone.trim(), email: item.email.trim() }));
  return { decision_makers: decisionMakers, decision_maker_name: decisionMakers[0]?.name ?? '' };
}
