import type { EdpPreview, EdpPreviewInput, EdpTemplateVariables } from './types';

const PLACEHOLDER = /{{\s*([a-z][a-z0-9_]*)\s*}}/gi;

export class EdpTemplateError extends Error {
  readonly name = 'EdpTemplateError';

  constructor(readonly placeholder: string) {
    super(`Variável EDP desconhecida: ${placeholder}`);
  }
}

export function escapeEdpHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function printable(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function renderEdpTemplate(
  source: string,
  variables: EdpTemplateVariables,
  mode: 'html' | 'text',
): string {
  return source.replace(PLACEHOLDER, (_match: string, placeholder: string) => {
    if (!(placeholder in variables)) throw new EdpTemplateError(placeholder);
    const value = printable(variables[placeholder]);
    return mode === 'html' ? escapeEdpHtml(value) : value;
  });
}

export function renderEdpSubject(source: string, variables: EdpTemplateVariables): string {
  return renderEdpTemplate(source, variables, 'text')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

export function buildEdpPreview(input: EdpPreviewInput): EdpPreview {
  const variables = {
    client_name: input.client.name,
    client_nif: input.client.nif,
    proposal_number: input.draft.proposal_number,
    energy_type: input.draft.energy_type,
    billing_email: input.draft.billing_email,
  } satisfies EdpTemplateVariables;
  return {
    subject: renderEdpSubject(input.settings.subject_template, variables),
    html: renderEdpTemplate(input.settings.body_template, variables, 'html'),
  };
}
