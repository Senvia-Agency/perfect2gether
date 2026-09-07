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

/**
 * Perfis que podem ficar responsaveis por uma lead. So estes aparecem no
 * seletor de "Atribuicao" -- perfis de apoio ou de leitura (Back Office,
 * Financeiro, Visualizador, admins) nao carregam carteira de leads.
 */
export const LEAD_ASSIGNABLE_PROFILES = ['Comercial', 'CE', 'Diretor Comercial'] as const;

/**
 * True quando o membro pode ser responsavel por uma lead, pelo nome do
 * perfil que lhe esta atribuido.
 */
export function canOwnLeads(profileName: string | null | undefined): boolean {
  if (!profileName) return false;
  return (LEAD_ASSIGNABLE_PROFILES as readonly string[]).includes(profileName);
}

/**
 * Reads the CPE/CUI list from a lead's custom_data. Leads created before
 * multi-CPE support stored a single string at custom_data.cpe; those are
 * read as a one-item list so old leads keep displaying correctly.
 */
export function getLeadCpes(customData: Record<string, unknown> | null | undefined): string[] {
  const data = customData || {};
  if (Array.isArray(data.cpes)) {
    return (data.cpes as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  }
  if (typeof data.cpe === 'string' && data.cpe.trim() !== '') {
    return [data.cpe];
  }
  return [];
}

/**
 * Builds the custom_data.cpes value to persist from a list of (possibly
 * empty/duplicate) input values. Trims, drops blanks, dedupes. Always
 * writes the new plural array field going forward.
 */
export function buildLeadCpesPatch(values: string[]): string[] | undefined {
  const cleaned = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  return cleaned.length ? cleaned : undefined;
}
