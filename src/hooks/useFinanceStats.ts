import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, endOfDay, format, isWithinInterval, parseISO, startOfDay, subDays } from 'date-fns';
import type { CashflowPoint, FinanceStats, PaymentWithSale } from '@/types/finance';
import type { PaymentMethod, PaymentRecordStatus, RecurringStatus } from '@/types/sales';
import { DateRange } from 'react-day-picker';

interface UseFinanceStatsOptions {
  dateRange?: DateRange;
}

const isStripePlanPayment = (payment: PaymentWithSale) => Boolean(payment.sale.client_org_id);

export function useFinanceStats(options?: UseFinanceStatsOptions) {
  const { organization } = useAuth();
  const organizationId = organization?.id;
  const dateRange = options?.dateRange;

  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ['finance-sales', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('id, total_value, created_at, sale_date')
        .eq('organization_id', organizationId);
      if (error) throw error;
      return (data || []).map((sale) => ({ ...sale, total_value: Number(sale.total_value || 0) }));
    },
    enabled: !!organizationId,
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['finance-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sale_payments')
        .select(`
          *,
          sales:sale_id!inner (
            id,
            code,
            status,
            total_value,
            client_org_id,
            recurring_status,
            next_renewal_date,
            leads:lead_id (name),
            crm_clients:client_id (name)
          )
        `)
        .eq('organization_id', organizationId)
        .order('payment_date', { ascending: true });

      if (error) {
        console.error('Error fetching finance stats:', error);
        throw error;
      }

      return (data || []).map((payment): PaymentWithSale => ({
        id: payment.id,
        organization_id: payment.organization_id,
        sale_id: payment.sale_id,
        amount: Number(payment.amount),
        payment_date: payment.payment_date,
        payment_method: payment.payment_method as PaymentMethod | null,
        invoice_reference: payment.invoice_reference,
        invoice_file_url: payment.invoice_file_url,
        invoicexpress_id: null,
        credit_note_id: null,
        credit_note_reference: null,
        status: payment.status as PaymentRecordStatus,
        notes: payment.notes,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        sale: {
          id: payment.sales?.id || '',
          code: payment.sales?.code || '',
          total_value: Number(payment.sales?.total_value || 0),
          invoice_reference: null,
          invoicexpress_id: null,
          invoicexpress_type: null,
          credit_note_id: null,
          credit_note_reference: null,
          invoice_pdf_url: null,
          client_org_id: (payment.sales as { client_org_id?: string | null } | null)?.client_org_id ?? null,
          recurring_status: (payment.sales as { recurring_status?: RecurringStatus | null } | null)?.recurring_status ?? null,
          next_renewal_date: (payment.sales as { next_renewal_date?: string | null } | null)?.next_renewal_date ?? null,
        },
        client_name: payment.sales?.crm_clients?.name || null,
        lead_name: payment.sales?.leads?.name || null,
      }));
    },
    enabled: !!organizationId,
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('organization_id', organizationId)
        .order('expense_date', { ascending: true });

      if (error) {
        console.error('Error fetching expenses:', error);
        throw error;
      }

      return (data || []).map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
      }));
    },
    enabled: !!organizationId,
  });

  const isLoading = loadingPayments || loadingExpenses || loadingSales;

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!dateRange?.from) return sales;
    return sales.filter((sale) => {
      const date = parseISO(sale.sale_date);
      if (dateRange.from && date < startOfDay(dateRange.from)) return false;
      if (dateRange.to && date > endOfDay(dateRange.to)) return false;
      return true;
    });
  }, [sales, dateRange]);

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (!dateRange?.from) return payments;
    return payments.filter((payment) => {
      const date = parseISO(payment.payment_date);
      if (dateRange.from && date < startOfDay(dateRange.from)) return false;
      if (dateRange.to && date > endOfDay(dateRange.to)) return false;
      return true;
    });
  }, [payments, dateRange]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!dateRange?.from) return expenses;
    return expenses.filter((expense) => {
      const date = parseISO(expense.expense_date);
      if (dateRange.from && date < startOfDay(dateRange.from)) return false;
      if (dateRange.to && date > endOfDay(dateRange.to)) return false;
      return true;
    });
  }, [expenses, dateRange]);

  const stats = useMemo((): FinanceStats => {
    const empty: FinanceStats = {
      totalBilled: 0,
      totalReceived: 0,
      totalPending: 0,
      dueSoon: 0,
      dueSoonCount: 0,
      dueSoonPayments: [],
      cashflowTrend: [],
      totalExpenses: 0,
      balance: 0,
      totalOverdue: 0,
      overdueCount: 0,
    };

    if (!filteredSales?.length && !filteredPayments?.length && !filteredExpenses?.length && !payments?.length) {
      return empty;
    }

    const now = new Date();
    const next7Days = addDays(now, 7);
    const eligibleFilteredPayments = filteredPayments.filter((payment) => !isStripePlanPayment(payment) || payment.status === 'paid');
    const globalPendingPayments = (payments || []).filter((payment) => payment.status === 'pending' && !isStripePlanPayment(payment));

    const totalBilled = filteredSales.reduce((sum, sale) => sum + sale.total_value, 0);

    const totalReceived = eligibleFilteredPayments
      .filter((payment) => payment.status === 'paid')
      .reduce((sum, payment) => sum + payment.amount, 0);

    const totalPending = globalPendingPayments.reduce((sum, payment) => sum + payment.amount, 0);

    const dueSoonPayments = eligibleFilteredPayments
      .filter((payment) => {
        if (payment.status !== 'pending') return false;
        const date = parseISO(payment.payment_date);
        return isWithinInterval(date, { start: startOfDay(now), end: endOfDay(next7Days) });
      })
      .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

    const dueSoon = dueSoonPayments.reduce((sum, payment) => sum + payment.amount, 0);

    const overduePayments = eligibleFilteredPayments.filter((payment) => {
      if (payment.status !== 'pending') return false;
      const date = parseISO(payment.payment_date);
      return date < startOfDay(now);
    });
    const totalOverdue = overduePayments.reduce((sum, payment) => sum + payment.amount, 0);

    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const balance = totalReceived - totalExpenses;

    const trendStart = dateRange?.from ? startOfDay(dateRange.from) : subDays(now, 30);
    const trendEnd = dateRange?.to ? endOfDay(dateRange.to) : next7Days;
    const cashflowTrend: CashflowPoint[] = [];

    for (let day = trendStart; day <= trendEnd; day = addDays(day, 1)) {
      const dayStr = format(day, 'yyyy-MM-dd');

      const received = eligibleFilteredPayments
        .filter((payment) => payment.status === 'paid' && payment.payment_date === dayStr)
        .reduce((sum, payment) => sum + payment.amount, 0);

      const scheduled = eligibleFilteredPayments
        .filter((payment) => payment.status === 'pending' && payment.payment_date === dayStr && parseISO(payment.payment_date) >= startOfDay(now))
        .reduce((sum, payment) => sum + payment.amount, 0);

      const expensesOnDay = filteredExpenses
        .filter((expense) => expense.expense_date === dayStr)
        .reduce((sum, expense) => sum + expense.amount, 0);

      const overdue = eligibleFilteredPayments
        .filter((payment) => payment.status === 'pending' && payment.payment_date === dayStr && parseISO(payment.payment_date) < startOfDay(now))
        .reduce((sum, payment) => sum + payment.amount, 0);

      cashflowTrend.push({ date: dayStr, received, scheduled, expenses: expensesOnDay, overdue });
    }

    return {
      totalBilled,
      totalReceived,
      totalPending,
      dueSoon,
      dueSoonCount: dueSoonPayments.length,
      dueSoonPayments,
      cashflowTrend,
      totalExpenses,
      balance,
      totalOverdue,
      overdueCount: overduePayments.length,
    };
  }, [dateRange, filteredExpenses, filteredPayments, filteredSales, payments]);

  return {
    stats,
    isLoading,
    payments: filteredPayments,
  };
}
