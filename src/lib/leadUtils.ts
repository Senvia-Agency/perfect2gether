/**
 * Detects placeholder emails generated when prospects without email are distributed.
 * Format: prospect-UUID@placeholder.local
 * Returns false for null/undefined/empty — those are simply "no email", not placeholders.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith('@placeholder.local');
}

/**
 * Returns the email for display, or empty string if it's a placeholder.
 */
export function displayEmail(email: string | null | undefined): string {
  if (!email || isPlaceholderEmail(email)) return '';
  return email;
}
