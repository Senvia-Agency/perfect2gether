import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeDatabase, fixture, harness } from './security-invoice-scope-fixtures.mjs';

const payload = (handler, overrides = {}) => ({
  organization_id: 'org-a', sale_id: 'sale-a', reason: 'Fixture reason',
  ...(handler === 'cancel-invoice' ? { invoicexpress_id: 101, document_type: 'invoice' }
    : { original_document_id: 101, original_document_type: 'invoice' }),
  ...overrides,
});
const document = (handler, id, type = 'invoice') => handler === 'cancel-invoice'
  ? { invoicexpress_id: id, document_type: type } : { original_document_id: id, original_document_type: type };

test('database fixture respects organization filters and reports duplicate single-row reads', async () => {
  // Given
  const rows = fixture();
  const { db } = fakeDatabase(rows);
  // When
  await db.from('sales').update({ credit_note_id: 999 }).eq('organization_id', 'org-a').eq('id', 'sale-b');
  const duplicate = await db.from('sales').select('id').eq('organization_id', 'org-a').maybeSingle();
  // Then
  assert.equal(rows.sales[1].credit_note_id, undefined);
  assert.ok(duplicate.error);
});

for (const handler of ['cancel-invoice', 'create-credit-note']) {
  for (const provider of ['invoicexpress', 'keyinvoice']) {
    const denied = [
      ['foreign sale', { sale_id: 'sale-b' }],
      ['foreign payment', { sale_id: null, payment_id: 'payment-b' }],
      ['different document', document(handler, 999)],
      ['different document type', document(handler, 101, 'receipt')],
      ['unrelated payment', { payment_id: 'payment-a' }],
      ['different parent sale', { sale_id: 'sale-other', payment_id: 'payment-a', ...document(handler, 111, 'receipt') }],
      ['missing sale', { sale_id: 'missing' }],
      ['unsupported document type', document(handler, 101, '../invoices')],
    ];
    for (const [scenario, overrides] of denied) {
      test(`${handler}/${provider} denies ${scenario} before billing`, async () => {
        // Given
        const rows = fixture(provider);
        const app = harness(handler, rows);
        // When
        const response = await app.invoke(payload(handler, overrides));
        // Then
        assert.equal(response.status, 403);
        assert.equal(app.providerRequests.length, 0);
        assert.equal(app.writes.length, 0);
      });
    }
    test(`${handler}/${provider} denies payment with a foreign parent sale`, async () => {
      // Given
      const rows = fixture(provider);
      rows.sale_payments[0].sale_id = 'sale-b';
      const app = harness(handler, rows);
      // When
      const response = await app.invoke(payload(handler, { sale_id: null, payment_id: 'payment-a', ...document(handler, 111, 'receipt') }));
      // Then
      assert.equal(response.status, 403);
      assert.equal(app.providerRequests.length, 0);
    });
    test(`${handler}/${provider} fails closed on ownership lookup errors`, async () => {
      // Given
      const app = harness(handler, fixture(provider));
      app.failures.add('invoices');
      // When
      const response = await app.invoke(payload(handler));
      // Then
      assert.equal(response.status, 403);
      assert.equal(app.providerRequests.length, 0);
    });
    for (const kind of ['sale', 'payment', 'sale and payment', 'legacy sale', 'legacy payment']) {
      test(`${handler}/${provider} preserves active-member ${kind} workflow`, async () => {
        // Given
        const rows = fixture(provider);
        if (kind.startsWith('legacy')) rows.invoices = [];
        const app = harness(handler, rows);
        const overrides = kind.includes('payment') ? { sale_id: kind === 'sale and payment' ? 'sale-a' : null,
          payment_id: 'payment-a', ...document(handler, 111, 'receipt') } : {};
        // When
        const response = await app.invoke(payload(handler, overrides));
        // Then
        assert.equal(response.status, 200);
        assert.equal((await response.json()).success, true);
        assert.ok(app.providerRequests.length > 0);
        for (const write of app.writes.filter(write => ['sales', 'sale_payments'].includes(write.table))) {
          assert.ok(write.filters.some(([key, value]) => key === 'organization_id' && value === 'org-a'));
        }
        assert.equal(rows.sales[1].credit_note_id, undefined);
        if (handler === 'cancel-invoice' && kind.includes('payment')) assert.equal(rows.sales[0].invoicexpress_id, 101);
        const mutation = app.providerRequests.find(request => provider === 'keyinvoice'
          ? request.body?.method === 'setDocumentVoid' : request.method === (handler === 'cancel-invoice' ? 'PUT' : 'POST'));
        if (provider === 'keyinvoice') {
          const isPayment = kind.includes('payment');
          const usesStoredReference = handler === 'create-credit-note' && !kind.startsWith('legacy');
          assert.deepEqual(mutation.body, {
            method: 'setDocumentVoid', CreditReason: 'Fixture reason',
            DocType: isPayment ? (handler === 'cancel-invoice' ? '6' : '10') : '4',
            DocNum: usesStoredReference ? (isPayment ? '2' : '1') : (isPayment ? '111' : '101'),
            ...(usesStoredReference ? { DocSeries: '47' } : {}),
          });
        }
        else if (handler === 'cancel-invoice') assert.equal(Object.values(mutation.body)[0].message, 'Fixture reason');
        else assert.deepEqual(mutation.body.credit_note.items, [{ name: 'Service', description: 'Service', unit_price: 10, quantity: 1 }]);
      });
    }
    if (handler === 'create-credit-note') test(`create-credit-note/${provider} preserves standalone finance invoice workflow`, async () => {
      // Given
      const app = harness(handler, fixture(provider));
      // When
      const response = await app.invoke(payload(handler, { sale_id: null }));
      // Then
      assert.equal(response.status, 200);
      assert.equal(app.writes.filter(write => ['sales', 'sale_payments'].includes(write.table)).length, 0);
    });
    test(`${handler}/${provider} denies inactive organization members`, async () => {
      // Given
      const rows = fixture(provider);
      rows.organization_members[0].is_active = false;
      const app = harness(handler, rows);
      // When
      const response = await app.invoke(payload(handler));
      // Then
      assert.equal(response.status, 403);
      assert.equal(app.providerRequests.length, 0);
    });
    test(`${handler}/${provider} denies stored invoice relationship mismatch`, async () => {
      // Given
      const rows = fixture(provider);
      rows.invoices[0].sale_id = 'sale-other';
      const app = harness(handler, rows);
      // When
      const response = await app.invoke(payload(handler));
      // Then
      assert.equal(response.status, 403);
      assert.equal(app.providerRequests.length, 0);
    });
    test(`${handler}/${provider} accepts numeric-string document IDs`, async () => {
      // Given
      const app = harness(handler, fixture(provider));
      // When
      const response = await app.invoke(payload(handler, document(handler, '101')));
      // Then
      assert.equal(response.status, 200);
    });
  }
}

test('create-credit-note rejects unknown standalone document before billing', async () => {
  // Given
  const app = harness('create-credit-note', fixture());
  // When
  const response = await app.invoke(payload('create-credit-note', { sale_id: null, original_document_id: 999 }));
  // Then
  assert.equal(response.status, 403);
  assert.equal(app.providerRequests.length, 0);
});

test('create-credit-note preserves custom item quantities, prices and taxes', async () => {
  // Given
  const app = harness('create-credit-note', fixture());
  const items = [{ name: 'Partial credit', description: 'Adjustment', unit_price: 3.5, quantity: 2, tax: { name: 'IVA23', value: 23 } }];
  // When
  const response = await app.invoke(payload('create-credit-note', { items }));
  // Then
  assert.equal(response.status, 200);
  assert.deepEqual(app.providerRequests.find(request => request.method === 'POST').body.credit_note.items, items);
});
