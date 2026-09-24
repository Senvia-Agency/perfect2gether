import assert from 'node:assert/strict';
import test from 'node:test';
import { getSaleCommission, isConcludedCommissionSale, sumConcludedCommissions } from './monthly-commissions.ts';

test('only concluded sales count toward monthly commissions', () => {
  assert.equal(sumConcludedCommissions([
    { status: 'cancelled', comissao: 132.24 },
    { status: 'fulfilled', comissao: 19.56 },
    { status: 'in_progress', comissao: 95.49 },
    { status: 'delivered', comissao: 0 },
  ]), 0);
});

test('energy uses the CPE-derived commission, including an explicit zero', () => {
  const sale = { status: 'delivered', comissao: 0.09, display_commission: 0 };
  assert.equal(isConcludedCommissionSale(sale), true);
  assert.equal(getSaleCommission(sale), 0);
  assert.equal(sumConcludedCommissions([sale, { status: 'delivered', comissao: 35.19 }]), 35.19);
});
