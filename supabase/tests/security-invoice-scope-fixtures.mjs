import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../functions');

export function fixture(provider = 'invoicexpress') {
  return {
    organization_members: [{ id: 'member', user_id: 'user', organization_id: 'org-a', is_active: true }],
    organizations: [{ id: 'org-a', billing_provider: provider, invoicexpress_account_name: 'fixture',
      invoicexpress_api_key: 'fake', keyinvoice_password: 'fake', keyinvoice_api_url: 'https://billing.invalid' }],
    sales: [{ id: 'sale-a', organization_id: 'org-a', invoicexpress_id: 101, invoicexpress_type: 'invoices' },
      { id: 'sale-b', organization_id: 'org-b', invoicexpress_id: 202, invoicexpress_type: 'invoices' },
      { id: 'sale-other', organization_id: 'org-a', invoicexpress_id: 303, invoicexpress_type: 'invoices' }],
    sale_payments: [{ id: 'payment-a', sale_id: 'sale-a', organization_id: 'org-a', invoicexpress_id: 111 },
      { id: 'payment-b', sale_id: 'sale-b', organization_id: 'org-b', invoicexpress_id: 222 }],
    invoices: [{ id: 'invoice-a', organization_id: 'org-a', invoicexpress_id: 101,
      document_type: 'invoice', sale_id: 'sale-a', payment_id: null, reference: '4 47/1',
      raw_data: { docType: '4', docSeries: '47', docNum: '1' } },
    { id: 'receipt-a', organization_id: 'org-a', invoicexpress_id: 111,
      document_type: 'receipt', sale_id: 'sale-a', payment_id: 'payment-a', reference: '10 47/2',
      raw_data: { docType: '10', docSeries: '47', docNum: '2' } }],
    credit_notes: [],
  };
}

export function fakeDatabase(rows) {
  const writes = [];
  const failures = new Set();
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) },
    rpc: async () => ({ data: rows.organization_members.some(row => row.user_id === 'user' && row.organization_id === 'org-a' && row.is_active), error: null }),
    from(table) {
      let operation = 'select';
      let values;
      const filters = [];
      const execute = () => {
        if (failures.has(table)) return { data: null, error: { message: 'fixture read failure' } };
        const matches = rows[table].filter(row => filters.every(([key, value]) => String(row[key]) === String(value)));
        if (operation !== 'select') {
          writes.push({ table, operation, values, filters: [...filters] });
          if (operation === 'update') matches.forEach(row => Object.assign(row, values));
          if (operation === 'upsert') rows[table].push(values);
        }
        return { data: matches, error: null };
      };
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        update(data) { operation = 'update'; values = data; return query; },
        upsert(data) { operation = 'upsert'; values = data; return query; },
        async maybeSingle() { const result = execute(); return { ...result, data: result.data?.length === 1 ? result.data[0] : null,
          error: result.error || (result.data?.length > 1 ? { message: 'multiple rows' } : null) }; },
        single() { return query.maybeSingle(); },
        then(onFulfilled, onRejected) { return Promise.resolve(execute()).then(onFulfilled, onRejected); },
      };
      return query;
    },
  };
  return { db, writes, failures };
}

export function harness(handlerName, rows) {
  const { db, writes, failures } = fakeDatabase(rows);
  const providerRequests = [];
  let handler;
  const context = vm.createContext({
    Request, Response, URL, Uint8Array, atob,
    console: { log() {}, warn() {}, error() {} },
    Deno: { env: { get: key => key === 'SUPABASE_URL' ? 'https://database.invalid' : 'fake' },
      serve: callback => { handler = callback; } },
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      providerRequests.push({ url, ...options, body });
      if (body?.method === 'authenticate') return Response.json({ Status: 1, Sid: 'fake-session' });
      if (body?.method === 'getDocumentPDF') return Response.json({ Status: 0 });
      if (body?.method === 'setDocumentVoid') return Response.json({ Status: 1, Data: {} });
      if (options.method === 'GET') return Response.json({ invoice: { sequential_number: '2026/1',
        client: { name: 'Client' }, items: [{ name: 'Service', unit_price: '10', quantity: '1' }] } });
      return Response.json({ credit_note: { id: 999, sequential_number: '2026/2' } });
    },
  });
  const load = path => {
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = specifier => {
      if (specifier.includes('@supabase/supabase-js')) return { createClient: () => db };
      if (specifier.includes('zod')) return { z };
      if (specifier.startsWith('.')) return load(resolve(dirname(path), specifier));
      throw new Error(`Unexpected dependency: ${specifier}`);
    };
    vm.runInContext(`(function(require, module, exports) { ${code}\n})`, context)(require, module, module.exports);
    return module.exports;
  };
  load(resolve(root, handlerName, 'index.ts'));
  return { writes, failures, providerRequests,
    invoke: payload => handler(new Request('https://edge.invalid', {
      method: 'POST', headers: { Authorization: 'Bearer fake', 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })),
  };
}
