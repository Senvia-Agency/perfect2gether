import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { EcommerceStats } from '@/types/ecommerce';

export function useEcommerceStats() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['ecommerce-stats', organizationId],
    queryFn: async (): Promise<EcommerceStats> => {
      if (!organizationId) {
        return {
          total_orders: 0,
          total_revenue: 0,
          pending_orders: 0,
          shipped_orders: 0,
          total_customers: 0,
          total_products: 0,
          low_stock_products: 0,
          orders_today: 0,
          revenue_today: 0,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // Fetch all stats in parallel
      const [
        ordersResult,
        pendingOrdersResult,
        shippedOrdersResult,
        customersResult,
        productsResult,
        todayOrdersResult,
      ] = await Promise.all([
        // Total orders and revenue
        supabase
          .from('orders')
          .select('total, payment_status')
          .eq('organization_id', organizationId),
        
        // Pending orders
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'pending'),
        
        // Shipped orders
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'shipped'),
        
        // Total customers
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        
        // Low stock products
        supabase
          .from('products')
          .select('stock_quantity, low_stock_threshold')
          .eq('organization_id', organizationId)
          .eq('is_ecommerce', true)
          .eq('track_inventory', true),
        
        // Today's orders
        supabase
          .from('orders')
          .select('total, payment_status')
          .eq('organization_id', organizationId)
          .gte('created_at', todayIso),
      ]);

      // Calculate total revenue (only from paid orders)
      const totalOrders = ordersResult.data?.length || 0;
      const totalRevenue = ordersResult.data
        ?.filter(o => o.payment_status === 'paid')
        ?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

      // Calculate today's stats
      const ordersToday = todayOrdersResult.data?.length || 0;
      const revenueToday = todayOrdersResult.data
        ?.filter(o => o.payment_status === 'paid')
        ?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

      // Calculate low stock products
      const lowStockProducts = productsResult.data?.filter(
        p => (p.stock_quantity || 0) <= (p.low_stock_threshold || 5)
      ).length || 0;

      return {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        pending_orders: pendingOrdersResult.count || 0,
        shipped_orders: shippedOrdersResult.count || 0,
        total_customers: customersResult.count || 0,
        total_products: productsResult.data?.length || 0,
        low_stock_products: lowStockProducts,
        orders_today: ordersToday,
        revenue_today: revenueToday,
      };
    },
    enabled: !!organizationId,
    refetchInterval: 60000, // Refresh every minute
  });
}
