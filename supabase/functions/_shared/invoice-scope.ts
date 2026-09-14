import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'

const invoiceScopeSchema = z.object({
  organization_id: z.string().min(1),
  sale_id: z.string().min(1).nullish(),
  payment_id: z.string().min(1).nullish(),
  document_id: z.union([z.number().int().safe(), z.string().regex(/^-?\d+$/)]),
  document_type: z.enum(['invoice', 'invoice_receipt', 'receipt', 'credit_note']),
})

const saleDocumentTypes: Readonly<Record<string, string>> = {
  FT: 'invoice', invoices: 'invoice', invoice: 'invoice', '4': 'invoice',
  FR: 'invoice_receipt', invoice_receipts: 'invoice_receipt', invoice_receipt: 'invoice_receipt',
  '20': 'invoice_receipt', '34': 'invoice_receipt',
  RC: 'receipt', receipts: 'receipt', receipt: 'receipt', '6': 'receipt', '10': 'receipt',
}

// Both mutation handlers use service_role, so every supplied relationship needs its own scope check.
export async function hasInvoiceScope(supabase: SupabaseClient, input: unknown): Promise<boolean> {
  const parsed = invoiceScopeSchema.safeParse(input)
  if (!parsed.success) return false
  const scope = parsed.data
  const { data: invoice, error: invoiceError } = await supabase.from('invoices')
    .select('sale_id, payment_id, document_type')
    .eq('organization_id', scope.organization_id)
    .eq('invoicexpress_id', scope.document_id)
    .maybeSingle()
  if (invoiceError || (invoice?.document_type && invoice.document_type !== scope.document_type)) return false

  const paymentResult = scope.payment_id
    ? await supabase.from('sale_payments').select('id, sale_id, invoicexpress_id')
      .eq('organization_id', scope.organization_id).eq('id', scope.payment_id).maybeSingle()
    : null
  const payment = paymentResult?.data
  if (scope.payment_id && (paymentResult?.error || !payment)) return false
  if (payment && scope.sale_id && payment.sale_id !== scope.sale_id) return false

  const saleId = scope.sale_id || payment?.sale_id
  const saleResult = saleId
    ? await supabase.from('sales').select('id, invoicexpress_id, invoicexpress_type')
      .eq('organization_id', scope.organization_id).eq('id', saleId).maybeSingle()
    : null
  const sale = saleResult?.data
  if (saleId && (saleResult?.error || !sale)) return false
  if (payment && !sale) return false

  if (invoice?.sale_id && saleId && invoice.sale_id !== saleId) return false
  if (invoice?.payment_id && scope.payment_id && invoice.payment_id !== scope.payment_id) return false
  const paymentMatches = payment && (invoice?.payment_id === payment.id ||
    (payment.invoicexpress_id !== null && String(payment.invoicexpress_id) === String(scope.document_id)))
  if (scope.payment_id && !paymentMatches) return false

  const saleMatches = sale && (invoice?.sale_id === sale.id ||
    (sale.invoicexpress_id !== null && String(sale.invoicexpress_id) === String(scope.document_id)))
  if (scope.sale_id && !saleMatches && !paymentMatches) return false
  if (!invoice && saleMatches && !paymentMatches) {
    const storedType = saleDocumentTypes[sale.invoicexpress_type]
    if (storedType && storedType !== scope.document_type) return false
  }

  // InvoiceXpress issuance can precede invoice synchronization; direct references remain valid.
  // Finance also supports invoice-only credit notes without a sale or payment association.
  return Boolean(invoice || saleMatches || paymentMatches)
}
