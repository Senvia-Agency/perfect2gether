// =====================================================
// SENVIA OS - E-COMMERCE MODULE - TYPES
// =====================================================

// ==================== STATUS TYPES ====================

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled';
export type ShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'returned';
export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';
export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'return';
export type AddressType = 'shipping' | 'billing';

// ==================== PRODUCT TYPES ====================

export interface ProductCategory {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  image_url?: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  parent?: ProductCategory | null;
  children?: ProductCategory[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text?: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariantOptions {
  [key: string]: string; // e.g., { "size": "M", "color": "Azul" }
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku?: string | null;
  name: string;
  price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  weight_grams?: number | null;
  is_active: boolean;
  options: ProductVariantOptions;
  created_at: string;
  updated_at: string;
}

export interface EcommerceProduct {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  short_description?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  sku?: string | null;
  slug?: string | null;
  category_id?: string | null;
  weight_grams?: number | null;
  is_digital: boolean;
  requires_shipping: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  category?: ProductCategory | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
}

// ==================== INVENTORY TYPES ====================

export interface InventoryMovement {
  id: string;
  organization_id: string;
  product_id?: string | null;
  variant_id?: string | null;
  quantity: number;
  type: MovementType;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  // Relations
  product?: EcommerceProduct | null;
  variant?: ProductVariant | null;
  creator?: { full_name: string } | null;
}

// ==================== CUSTOMER TYPES ====================

export interface Customer {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  phone?: string | null;
  accepts_marketing: boolean;
  notes?: string | null;
  total_orders: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  // Relations
  addresses?: CustomerAddress[];
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  type: AddressType;
  is_default: boolean;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  postal_code: string;
  country: string;
  phone?: string | null;
  created_at: string;
}

export interface AddressData {
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code: string;
  country: string;
  phone?: string;
}

// ==================== ORDER TYPES ====================

export interface Order {
  id: string;
  organization_id: string;
  order_number: string;
  customer_id?: string | null;
  lead_id?: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  discount_code?: string | null;
  shipping_address?: AddressData | null;
  billing_address?: AddressData | null;
  notes?: string | null;
  internal_notes?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  customer?: Customer | null;
  items?: OrderItem[];
  shipments?: Shipment[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
  // Relations
  product?: EcommerceProduct | null;
  variant?: ProductVariant | null;
}

// ==================== SHIPMENT TYPES ====================

export interface Shipment {
  id: string;
  order_id: string;
  organization_id: string;
  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  status: ShipmentStatus;
  shipped_at?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  order?: Order | null;
}

// ==================== DISCOUNT TYPES ====================

export interface DiscountCode {
  id: string;
  organization_id: string;
  code: string;
  type: DiscountType;
  value: number;
  min_purchase?: number | null;
  max_uses?: number | null;
  uses_count: number;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
}

// ==================== CART TYPES (Frontend only) ====================

export interface CartItem {
  product_id: string;
  variant_id?: string;
  product_name: string;
  variant_name?: string;
  sku?: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount_total: number;
  discount_code?: string;
  shipping_total: number;
  tax_total: number;
  total: number;
}

// ==================== FORM TYPES ====================

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  image_url?: string;
  position?: number;
  is_active?: boolean;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  id: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  short_description?: string;
  price?: number;
  compare_at_price?: number;
  sku?: string;
  slug?: string;
  category_id?: string;
  weight_grams?: number;
  is_digital?: boolean;
  requires_shipping?: boolean;
  track_inventory?: boolean;
  stock_quantity?: number;
  low_stock_threshold?: number;
  tags?: string[];
  is_active?: boolean;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

export interface CreateVariantInput {
  product_id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
  weight_grams?: number;
  is_active?: boolean;
  options?: ProductVariantOptions;
}

export interface UpdateVariantInput extends Partial<Omit<CreateVariantInput, 'product_id'>> {
  id: string;
}

export interface CreateCustomerInput {
  email: string;
  name: string;
  phone?: string;
  accepts_marketing?: boolean;
  notes?: string;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  id: string;
}

export interface CreateOrderInput {
  customer_id?: string;
  lead_id?: string;
  items: {
    product_id?: string;
    variant_id?: string;
    product_name: string;
    variant_name?: string;
    sku?: string;
    quantity: number;
    unit_price: number;
  }[];
  shipping_address?: AddressData;
  billing_address?: AddressData;
  discount_code?: string;
  shipping_total?: number;
  notes?: string;
}

export interface UpdateOrderInput {
  id: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  fulfillment_status?: FulfillmentStatus;
  internal_notes?: string;
  notes?: string;
}

export interface CreateShipmentInput {
  order_id: string;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  notes?: string;
}

export interface UpdateShipmentInput {
  id: string;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  status?: ShipmentStatus;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
}

export interface CreateDiscountInput {
  code: string;
  type: DiscountType;
  value: number;
  min_purchase?: number;
  max_uses?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: boolean;
}

export interface UpdateDiscountInput extends Partial<CreateDiscountInput> {
  id: string;
}

// ==================== STATS & DASHBOARD ====================

export interface EcommerceStats {
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
  shipped_orders: number;
  total_customers: number;
  total_products: number;
  low_stock_products: number;
  orders_today: number;
  revenue_today: number;
}

// ==================== CARRIERS ====================

export const CARRIERS = [
  { value: 'ctt', label: 'CTT' },
  { value: 'ctt_expresso', label: 'CTT Expresso' },
  { value: 'dpd', label: 'DPD' },
  { value: 'gls', label: 'GLS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'mrw', label: 'MRW' },
  { value: 'seur', label: 'SEUR' },
  { value: 'other', label: 'Outro' },
] as const;

// ==================== STATUS LABELS ====================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  processing: 'Em Processamento',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  refunded: 'Reembolsado',
  failed: 'Falhado',
};

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  unfulfilled: 'Não Expedido',
  partial: 'Parcialmente Expedido',
  fulfilled: 'Expedido',
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pendente',
  in_transit: 'Em Trânsito',
  delivered: 'Entregue',
  returned: 'Devolvido',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentagem',
  fixed_amount: 'Valor Fixo',
  free_shipping: 'Envio Grátis',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase: 'Compra',
  sale: 'Venda',
  adjustment: 'Ajuste',
  return: 'Devolução',
};
