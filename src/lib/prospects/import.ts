import type { ProspectImportResult } from "@/types/prospects";

export const PROSPECTS_ACCESS_ERROR = "A tua conta não tem acesso aos Prospects desta organização.";

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const stringify = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const normalizeTextValue = (value: unknown) => stringify(value).replace(/\s+/g, " ").trim();

export const normalizeIdentifierValue = (value: unknown) => stringify(value).replace(/\s+/g, "").toUpperCase();

export const normalizeEmail = (value: unknown) => {
  const email = stringify(value).toLowerCase();
  return email.includes("@") ? email : "";
};

export const parseNumericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const input = stringify(value);
  if (!input) return null;

  const sanitized = input.replace(/\s/g, "");
  const normalized = sanitized.includes(",") && sanitized.includes(".")
    ? sanitized.replace(/\./g, "").replace(/,/g, ".")
    : sanitized.replace(/,/g, ".");

  const numeric = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const findValue = (row: Record<string, unknown>, aliases: string[]) => {
  const aliasSet = new Set(aliases.map(normalizeHeader));

  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeader(key))) {
      return value;
    }
  }

  return "";
};

const sanitizeForJson = (value: unknown): unknown => {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return null;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeForJson);

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeForJson(entry)]),
    );
  }

  return stringify(value);
};

const parseContactField = (value: unknown) => {
  const raw = normalizeTextValue(value);
  if (!raw) return { phone: null as string | null, contactName: null as string | null };

  const digitCount = raw.replace(/\D/g, "").length;
  if (digitCount >= 8) {
    return { phone: raw, contactName: null };
  }

  return { phone: null, contactName: raw };
};

export const buildProspectPayload = ({
  row,
  fileName,
  organizationId,
  userId,
}: {
  row: Record<string, unknown>;
  fileName: string;
  organizationId: string;
  userId?: string;
}) => {
  const companyName = normalizeTextValue(findValue(row, ["Nome da Empresa", "Empresa", "Company", "Nome"]));
  const email = normalizeEmail(findValue(row, ["Email", "E-mail", "Mail"]));
  const contactField = findValue(row, ["Contato", "Contacto", "Telefone", "Phone"]);
  const { phone, contactName } = parseContactField(contactField);

  const nif = normalizeIdentifierValue(findValue(row, ["NIF"]));
  const cpe = normalizeIdentifierValue(findValue(row, ["CPE"]));
  const com = normalizeTextValue(findValue(row, ["COM", "Concorrência", "Concorrencia", "Comercializador", "Comercializadora"]));
  const segment = normalizeTextValue(findValue(row, ["Segmento", "Segment"])) || com;
  const status = normalizeTextValue(findValue(row, ["Estado", "Status"])) || "new";
  const annualConsumption = parseNumericValue(findValue(row, ["kWhAno", "kWh Ano", "Consumo Anual", "kwhano"]));
  const observations = normalizeTextValue(findValue(row, ["Observações", "Observacoes", "Notas", "Notes"]));

  return {
    organization_id: organizationId,
    company_name: companyName,
    contact_name: contactName,
    email: email || null,
    phone,
    nif: nif || null,
    cpe: cpe || null,
    segment: segment || null,
    status,
    annual_consumption_kwh: annualConsumption,
    observations: observations || null,
    source: "import",
    source_file_name: fileName,
    imported_by: userId || null,
    metadata: {
      numero: normalizeTextValue(findValue(row, ["Numero", "Número"])) || null,
      nt: normalizeTextValue(findValue(row, ["NT"])) || null,
      pc: parseNumericValue(findValue(row, ["PC"])),
      com: com || null,
      gestor_totallink: normalizeTextValue(findValue(row, ["Gestor Totallink", "Gestor"])) || null,
      raw_row: sanitizeForJson(row),
    },
  };
};

const extractErrorDetails = (error: unknown) => {
  const fallback = {
    message: "",
    details: "",
    hint: "",
    code: "",
  };

  if (error instanceof Error) {
    const source = error as Error & { details?: string; hint?: string; code?: string; cause?: unknown };
    const cause = source.cause && typeof source.cause === "object" ? source.cause as Record<string, unknown> : null;

    return {
      message: source.message || (typeof cause?.message === "string" ? cause.message : ""),
      details: source.details || (typeof cause?.details === "string" ? cause.details : ""),
      hint: source.hint || (typeof cause?.hint === "string" ? cause.hint : ""),
      code: source.code || (typeof cause?.code === "string" ? cause.code : ""),
    };
  }

  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    return {
      message: typeof source.message === "string" ? source.message : "",
      details: typeof source.details === "string" ? source.details : "",
      hint: typeof source.hint === "string" ? source.hint : "",
      code: typeof source.code === "string" ? source.code : "",
    };
  }

  return {
    ...fallback,
    message: typeof error === "string" ? error : "",
  };
};

export const isDuplicateConflictError = (error: unknown) => {
  const { message, details, code } = extractErrorDetails(error);
  const normalized = `${message} ${details}`.toLowerCase();

  return code === "23505" || normalized.includes("duplicate key") || normalized.includes("already exists");
};

export const mapProspectsError = (error: unknown) => {
  const { message, details, hint, code } = extractErrorDetails(error);
  const normalizedMessage = `${message} ${details} ${hint}`.toLowerCase();

  if (
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("violates row-level security policy") ||
    normalizedMessage.includes("permission denied")
  ) {
    return PROSPECTS_ACCESS_ERROR;
  }

  const combined = [message, details, hint].filter(Boolean).join(" • ");
  if (combined) return combined;
  if (code) return `Erro ao importar prospects (${code})`;

  if (error && typeof error === "object") {
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // noop
    }
  }

  return "Erro ao importar prospects";
};

export const createEmptyImportResult = (): ProspectImportResult => ({
  inserted: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  firstError: null,
});
