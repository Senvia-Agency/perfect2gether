export type EdpApiErrorKind = "revision_conflict" | "permission" | "validation" | "transport" | "unknown";

export class EdpApiError extends Error {
  readonly name: string = "EdpApiError";
  readonly kind: EdpApiErrorKind;

  constructor(
    kind: EdpApiErrorKind,
    message: string,
  ) {
    super(message);
    this.kind = kind;
  }
}

export class EdpRevisionConflictError extends EdpApiError {
  readonly name = "EdpRevisionConflictError";

  constructor(message: string) {
    super("revision_conflict", message);
  }
}

export function toEdpApiError(error: unknown): EdpApiError {
  if (error instanceof EdpApiError) return error;

  const code = readString(error, "code");
  const message = readString(error, "message") ?? (error instanceof Error ? error.message : "Erro EDP desconhecido");
  if (code === "40001" || message.includes("revision_conflict")) {
    return new EdpRevisionConflictError(message);
  }
  if (code === "42501") return new EdpApiError("permission", message);
  if (code === "22023") return new EdpApiError("validation", message);
  if (error instanceof TypeError) return new EdpApiError("transport", message);
  return new EdpApiError("unknown", message);
}

function readString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const field = Reflect.get(value, key);
  return typeof field === "string" ? field : null;
}
