import type { Prospect } from "@/types/prospects";

const normalizeMetadataText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized || null;
};

export const getProspectSegment = (
  prospect: Pick<Prospect, "segment">
): string | null => {
  return normalizeMetadataText(prospect.segment);
};

export const getProspectCom = (
  prospect: Pick<Prospect, "metadata">
): string | null => {
  return normalizeMetadataText(prospect.metadata?.com);
};
