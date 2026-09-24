export interface MonthlyCommissionSale {
  status: string;
  comissao: number | null;
  display_commission?: number | null;
}

export function isConcludedCommissionSale(sale: MonthlyCommissionSale): boolean {
  return sale.status === 'delivered';
}

export function getSaleCommission(sale: MonthlyCommissionSale): number {
  return Number(sale.display_commission ?? sale.comissao) || 0;
}

export function sumConcludedCommissions(sales: MonthlyCommissionSale[]): number {
  return sales.filter(isConcludedCommissionSale)
    .reduce((total, sale) => total + getSaleCommission(sale), 0);
}
