import { SERVICOS_PRODUCT_CONFIGS, type ServicosDetails, type ServicosProductConfig } from '@/types/proposals';

export interface ServicosValidationError {
  product: string;
  field: string;
  message: string;
}

/**
 * Validates that all selected servicos products have their required fields filled.
 * Accepts an optional configs array; falls back to the hardcoded defaults.
 */
export function validateServicosDetails(
  servicosProdutos: string[],
  servicosDetails: ServicosDetails,
  configs: ServicosProductConfig[] = SERVICOS_PRODUCT_CONFIGS
): ServicosValidationError[] {
  const errors: ServicosValidationError[] = [];

  for (const produto of servicosProdutos) {
    const config = configs.find(c => c.name === produto);
    if (!config) continue;

    const detail = servicosDetails[produto] || {};

    for (const field of config.fields) {
      if (detail[field] === undefined || detail[field] === null || detail[field] <= 0) {
        errors.push({
          product: produto,
          field,
          message: `${produto}: campo ${field} é obrigatório e deve ser maior que 0`,
        });
      }
    }
  }

  return errors;
}

/**
 * Quick boolean check — are all servicos fields valid?
 */
export function isServicosDetailsValid(
  servicosProdutos: string[],
  servicosDetails: ServicosDetails,
  configs?: ServicosProductConfig[]
): boolean {
  if (servicosProdutos.length === 0) return false;
  return validateServicosDetails(servicosProdutos, servicosDetails, configs).length === 0;
}

/**
 * Check if a specific field on a specific product is invalid.
 */
export function isFieldInvalid(
  produto: string,
  field: string,
  servicosDetails: ServicosDetails
): boolean {
  const detail = servicosDetails[produto] || {};
  return detail[field] === undefined || detail[field] === null || detail[field] <= 0;
}
