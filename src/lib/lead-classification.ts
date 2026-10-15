import { z } from 'zod';
import type { Lead } from '@/types';

export const LEAD_CLIENT_SEGMENTS = ['bronze', 'prata', 'ouro'] as const;
export const leadClientSegmentSchema = z.enum(LEAD_CLIENT_SEGMENTS);
export type LeadClientSegment = z.infer<typeof leadClientSegmentSchema>;
export const LEAD_CLIENT_SEGMENT_LABELS: Readonly<Record<LeadClientSegment, string>> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
};

export function getLeadClientSegment(customData: Lead['custom_data']): LeadClientSegment | undefined {
  const parsed = leadClientSegmentSchema.safeParse(customData?.client_segment);
  return parsed.success ? parsed.data : undefined;
}

export function withLeadClientSegment(customData: Lead['custom_data'], segment: LeadClientSegment): NonNullable<Lead['custom_data']> {
  return { ...customData, client_segment: segment };
}
