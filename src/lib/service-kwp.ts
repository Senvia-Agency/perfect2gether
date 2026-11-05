// kWp de uma proposta/venda de serviços (solar). Coberturas não contam como potência instalada.
const EXCLUDED_SERVICE_PRODUCT_NAMES = new Set(["cobertura", "coberturas"]);

function normalizeServiceProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function serviceDetailsKwp(details: unknown): number {
  if (!details || typeof details !== "object") return 0;
  let total = 0;
  for (const [productKey, rawProduct] of Object.entries(details as Record<string, unknown>)) {
    const product = (rawProduct ?? {}) as { name?: unknown; kwp?: unknown };
    const name = typeof product.name === "string" ? product.name : productKey;
    if (EXCLUDED_SERVICE_PRODUCT_NAMES.has(normalizeServiceProductName(name))) continue;
    total += Number(product.kwp) || 0;
  }
  return total;
}

// Detalhe por produto primeiro; propostas antigas guardavam o kWp só no nível superior.
export function serviceKwp(details: unknown, legacyKwp: unknown): number {
  return serviceDetailsKwp(details) || Number(legacyKwp) || 0;
}
