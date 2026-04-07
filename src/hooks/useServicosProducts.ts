import { useMemo } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import {
  SERVICOS_PRODUCTS,
  SERVICOS_PRODUCT_CONFIGS,
  type ServicosProductConfig,
  type CatalogProduct,
} from '@/types/proposals';

interface LegacyConfigFromDB {
  name: string;
  fields: string[];
}

interface CatalogConfigFromDB {
  name: string;
  price: number;
  has_commission: boolean;
  commission_pct: number;
}

function isCatalogFormat(item: any): item is CatalogConfigFromDB {
  return item && typeof item.price === 'number' && typeof item.has_commission === 'boolean';
}

/**
 * Returns the list of servicos products and their configs.
 * Detects format:
 * - NULL → fallback to hardcoded (Perfect2Gether)
 * - Legacy format [{name, fields}] → map to ServicosProductConfig
 * - New catalog format [{name, price, has_commission, commission_pct}] → CatalogProduct[]
 */
export function useServicosProducts() {
  const { data: org } = useOrganization();

  return useMemo(() => {
    const config = (org as any)?.servicos_products_config as any[] | null;

    if (!config || !Array.isArray(config) || config.length === 0) {
      return {
        products: SERVICOS_PRODUCTS,
        configs: SERVICOS_PRODUCT_CONFIGS,
        catalog: null as CatalogProduct[] | null,
        isNewFormat: false,
      };
    }

    // Detect format by checking first item
    if (isCatalogFormat(config[0])) {
      // New catalog format
      const catalog: CatalogProduct[] = config.map((c) => ({
        name: c.name,
        price: c.price ?? 0,
        has_commission: c.has_commission ?? false,
        commission_pct: c.commission_pct ?? 0,
      }));
      return {
        products: catalog.map((c) => c.name),
        configs: [] as ServicosProductConfig[], // Not used in new format
        catalog,
        isNewFormat: true,
      };
    }

    // Legacy format with fields
    const products = config.map((c: LegacyConfigFromDB) => c.name);
    const configs: ServicosProductConfig[] = config.map((c: LegacyConfigFromDB) => ({
      name: c.name,
      fields: c.fields as ServicosProductConfig['fields'],
    }));

    return {
      products,
      configs,
      catalog: null as CatalogProduct[] | null,
      isNewFormat: false,
    };
  }, [org]);
}
