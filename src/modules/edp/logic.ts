export type DispatchOutcome =
  | "idle"
  | "transport_error"
  | "failed"
  | "uncertain"
  | "accepted";

export type EdpTransportStatus = "accepted" | "failed" | "uncertain";

export function nextDispatchKey(
  outcome: DispatchOutcome,
  currentKey: string | null,
  createKey: () => string,
): string | null {
  switch (outcome) {
    case "idle":
    case "failed":
      return createKey();
    case "transport_error":
      return currentKey ?? createKey();
    case "accepted":
    case "uncertain":
      return null;
    default:
      return assertNever(outcome);
  }
}

export function parseRecipientList(value: string): readonly string[] {
  const recipients: string[] = [];
  const seen = new Set<string>();

  for (const part of value.split(/[;,\n]+/u)) {
    const recipient = part.trim();
    const comparisonKey = recipient.toLocaleLowerCase("pt-PT");
    if (recipient.length === 0 || seen.has(comparisonKey)) continue;

    seen.add(comparisonKey);
    recipients.push(recipient);
  }

  return recipients;
}

export function getEdpTransportLabel(status: EdpTransportStatus): string {
  switch (status) {
    case "accepted":
      return "Aceite pelo transporte";
    case "failed":
      return "Falhou";
    case "uncertain":
      return "Resultado incerto";
    default:
      return assertNever(status);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Estado EDP inesperado: ${String(value)}`);
}
