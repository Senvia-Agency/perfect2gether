import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: { code: string; message: string };
  meta?: {
    organization?: string;
    currency: string;
    timestamp: string;
  };
}

function jsonResponse(response: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

// Get organization by public key
async function getOrganization(supabase: any, publicKey: string) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, public_key')
    .eq('public_key', publicKey)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

// GET: List all active products
async function handleGetProducts(supabase: any, orgId: string, params: URLSearchParams) {
  const limit = parseInt(params.get('limit') || '50');
  const offset = parseInt(params.get('offset') || '0');
  const categorySlug = params.get('category');
  const search = params.get('search');

  let query = supabase
    .from('ecommerce_products')
    .select(`
      id, name, slug, short_description, description, price, compare_at_price,
      sku, tags, is_digital, requires_shipping,
      category_id,
      product_categories(id, name, slug),
      product_variants(id, name, sku, price, compare_at_price, stock_quantity, options, is_active),
      product_images(id, url, alt_text, position, is_primary)
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')
    .range(offset, offset + limit - 1);

  if (categorySlug) {
    const { data: category } = await supabase
      .from('product_categories')
      .select('id')
      .eq('organization_id', orgId)
      .eq('slug', categorySlug)
      .single();

    if (category) {
      query = query.eq('category_id', category.id);
    }
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error('Failed to fetch products');
  }

  // Filter out inactive variants and sort images
  const products = (data || []).map((product: any) => ({
    ...product,
    product_variants: (product.product_variants || [])
      .filter((v: any) => v.is_active)
      .map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        in_stock: (v.stock_quantity || 0) > 0,
        stock_quantity: v.stock_quantity,
        options: v.options,
      })),
    product_images: (product.product_images || [])
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
    category: product.product_categories,
    product_categories: undefined,
  }));

  return { products, total: count };
}

// GET: Single product by slug or ID
async function handleGetProduct(supabase: any, orgId: string, params: URLSearchParams) {
  const slug = params.get('slug');
  const id = params.get('id');

  if (!slug && !id) {
    throw new Error('Product slug or id is required');
  }

  let query = supabase
    .from('ecommerce_products')
    .select(`
      id, name, slug, short_description, description, price, compare_at_price,
      sku, tags, is_digital, requires_shipping, weight_grams,
      category_id,
      product_categories(id, name, slug),
      product_variants(id, name, sku, price, compare_at_price, stock_quantity, options, is_active, weight_grams),
      product_images(id, url, alt_text, position, is_primary)
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (slug) {
    query = query.eq('slug', slug);
  } else {
    query = query.eq('id', id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new Error('Product not found');
  }

  return {
    ...data,
    product_variants: (data.product_variants || [])
      .filter((v: any) => v.is_active)
      .map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        in_stock: (v.stock_quantity || 0) > 0,
        stock_quantity: v.stock_quantity,
        options: v.options,
        weight_grams: v.weight_grams,
      })),
    product_images: (data.product_images || [])
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
    category: data.product_categories,
    product_categories: undefined,
  };
}

// GET: List all active categories
async function handleGetCategories(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name, slug, description, image_url, parent_id, position')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('position');

  if (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }

  return { categories: data || [] };
}

// GET: Products by category
async function handleGetCategory(supabase: any, orgId: string, params: URLSearchParams) {
  const slug = params.get('slug');
  const id = params.get('id');

  if (!slug && !id) {
    throw new Error('Category slug or id is required');
  }

  let categoryQuery = supabase
    .from('product_categories')
    .select('id, name, slug, description, image_url')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (slug) {
    categoryQuery = categoryQuery.eq('slug', slug);
  } else {
    categoryQuery = categoryQuery.eq('id', id);
  }

  const { data: category, error: catError } = await categoryQuery.single();

  if (catError || !category) {
    throw new Error('Category not found');
  }

  const { products } = await handleGetProducts(supabase, orgId, new URLSearchParams(`category=${category.slug}`));

  return { category, products };
}

// POST: Validate cart (check stock, prices)
async function handleValidateCart(supabase: any, orgId: string, body: any) {
  const { items, discount_code } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Cart items are required');
  }

  const validatedItems = [];
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const { product_id, variant_id, quantity } = item;

    if (!product_id || !quantity || quantity < 1) {
      throw new Error('Invalid cart item');
    }

    // Get product
    const { data: product, error: prodError } = await supabase
      .from('ecommerce_products')
      .select('id, name, slug, price, is_active, track_inventory, stock_quantity')
      .eq('id', product_id)
      .eq('organization_id', orgId)
      .single();

    if (prodError || !product || !product.is_active) {
      throw new Error(`Product ${product_id} not available`);
    }

    let price = product.price;
    let stock = product.stock_quantity || 0;
    let variantName = null;
    let sku = null;

    // If variant specified, use variant data
    if (variant_id) {
      const { data: variant, error: varError } = await supabase
        .from('product_variants')
        .select('id, name, price, stock_quantity, is_active, sku')
        .eq('id', variant_id)
        .eq('product_id', product_id)
        .single();

      if (varError || !variant || !variant.is_active) {
        throw new Error(`Variant ${variant_id} not available`);
      }

      price = variant.price;
      stock = variant.stock_quantity || 0;
      variantName = variant.name;
      sku = variant.sku;
    }

    // Check stock
    if (product.track_inventory && stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}${variantName ? ` - ${variantName}` : ''}`);
    }

    const itemTotal = price * quantity;
    subtotal += itemTotal;

    validatedItems.push({
      product_id,
      variant_id,
      product_name: product.name,
      variant_name: variantName,
      sku,
      quantity,
      unit_price: price,
      total: itemTotal,
      in_stock: !product.track_inventory || stock >= quantity,
    });
  }

  // Validate discount code if provided
  if (discount_code) {
    const { data: discount, error: discError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('organization_id', orgId)
      .eq('code', discount_code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!discError && discount) {
      const now = new Date();
      const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
      const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

      const isValid =
        (!startsAt || now >= startsAt) &&
        (!expiresAt || now <= expiresAt) &&
        (!discount.max_uses || (discount.uses_count || 0) < discount.max_uses) &&
        (!discount.min_purchase || subtotal >= discount.min_purchase);

      if (isValid) {
        if (discount.type === 'percentage') {
          discountTotal = (subtotal * discount.value) / 100;
        } else {
          discountTotal = Math.min(discount.value, subtotal);
        }
      }
    }
  }

  return {
    items: validatedItems,
    subtotal,
    discount_total: discountTotal,
    total: subtotal - discountTotal,
    currency: 'EUR',
  };
}

// POST: Create checkout/order
async function handleCheckout(supabase: any, orgId: string, body: any) {
  const { customer, items, shipping_address, billing_address, discount_code, notes } = body;

  if (!customer || !customer.email || !customer.name) {
    throw new Error('Customer name and email are required');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Cart items are required');
  }

  // Validate cart first
  const cartValidation = await handleValidateCart(supabase, orgId, { items, discount_code });

  // Find or create customer
  let customerId = null;
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', customer.email.toLowerCase())
    .single();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Update customer info
    await supabase
      .from('customers')
      .update({
        name: customer.name,
        phone: customer.phone || null,
      })
      .eq('id', customerId);
  } else {
    const { data: newCustomer, error: custError } = await supabase
      .from('customers')
      .insert({
        organization_id: orgId,
        name: customer.name,
        email: customer.email.toLowerCase(),
        phone: customer.phone || null,
        accepts_marketing: customer.accepts_marketing || false,
      })
      .select('id')
      .single();

    if (custError) {
      console.error('Error creating customer:', custError);
      throw new Error('Failed to create customer');
    }
    customerId = newCustomer.id;
  }

  // Generate order number
  const { data: orderNumber } = await supabase.rpc('generate_order_number', { _org_id: orgId });

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      order_number: orderNumber || `#${Date.now()}`,
      subtotal: cartValidation.subtotal,
      discount_total: cartValidation.discount_total,
      discount_code: discount_code || null,
      total: cartValidation.total,
      shipping_address: shipping_address || null,
      billing_address: billing_address || shipping_address || null,
      notes: notes || null,
      status: 'pending',
      payment_status: 'pending',
      fulfillment_status: 'unfulfilled',
    })
    .select('id, order_number')
    .single();

  if (orderError) {
    console.error('Error creating order:', orderError);
    throw new Error('Failed to create order');
  }

  // Create order items
  const orderItems = cartValidation.items.map((item: any) => ({
    order_id: order.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    product_name: item.product_name,
    variant_name: item.variant_name || null,
    sku: item.sku || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

  if (itemsError) {
    console.error('Error creating order items:', itemsError);
    // Rollback order
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error('Failed to create order items');
  }

  // Update stock for each item
  for (const item of cartValidation.items) {
    if (item.variant_id) {
      await supabase
        .from('product_variants')
        .update({ stock_quantity: supabase.raw(`stock_quantity - ${item.quantity}`) })
        .eq('id', item.variant_id);
    } else {
      await supabase
        .from('ecommerce_products')
        .update({ stock_quantity: supabase.raw(`stock_quantity - ${item.quantity}`) })
        .eq('id', item.product_id);
    }

    // Record inventory movement
    await supabase.from('inventory_movements').insert({
      organization_id: orgId,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      type: 'sale',
      quantity: -item.quantity,
      reference_id: order.id,
      notes: `Venda ${order.order_number}`,
    });
  }

  // Update discount usage
  if (discount_code && cartValidation.discount_total > 0) {
    await supabase
      .from('discount_codes')
      .update({ uses_count: supabase.raw('uses_count + 1') })
      .eq('organization_id', orgId)
      .eq('code', discount_code.toUpperCase());
  }

  // Update customer stats
  await supabase
    .from('customers')
    .update({
      total_orders: supabase.raw('total_orders + 1'),
      total_spent: supabase.raw(`total_spent + ${cartValidation.total}`),
    })
    .eq('id', customerId);

  return {
    order_id: order.id,
    order_number: order.order_number,
    total: cartValidation.total,
    currency: 'EUR',
    status: 'pending',
    message: 'Order created successfully',
  };
}

// POST: Customer login (simple email + phone verification)
async function handleCustomerLogin(supabase: any, orgId: string, body: any) {
  const { email, phone } = body;

  if (!email) {
    throw new Error('Email is required');
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .eq('organization_id', orgId)
    .eq('email', email.toLowerCase())
    .single();

  if (error || !customer) {
    throw new Error('Customer not found');
  }

  // Simple phone verification (last 4 digits)
  if (phone && customer.phone) {
    const last4Input = phone.replace(/\D/g, '').slice(-4);
    const last4Stored = customer.phone.replace(/\D/g, '').slice(-4);
    if (last4Input !== last4Stored) {
      throw new Error('Invalid credentials');
    }
  }

  return {
    customer_id: customer.id,
    name: customer.name,
    email: customer.email,
  };
}

// GET: Customer orders
async function handleGetOrders(supabase: any, orgId: string, params: URLSearchParams) {
  const customerId = params.get('customer_id');
  const email = params.get('email');

  if (!customerId && !email) {
    throw new Error('Customer ID or email is required');
  }

  let customerIdToUse = customerId;

  if (!customerIdToUse && email) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email.toLowerCase())
      .single();

    if (!customer) {
      return { orders: [] };
    }
    customerIdToUse = customer.id;
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, payment_status, fulfillment_status,
      subtotal, discount_total, shipping_total, total,
      created_at,
      order_items(id, product_name, variant_name, quantity, unit_price, total)
    `)
    .eq('organization_id', orgId)
    .eq('customer_id', customerIdToUse)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    throw new Error('Failed to fetch orders');
  }

  return { orders: orders || [] };
}

// POST: Validate discount code
async function handleValidateDiscount(supabase: any, orgId: string, body: any) {
  const { code, subtotal = 0 } = body;

  if (!code) {
    throw new Error('Discount code is required');
  }

  const { data: discount, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('organization_id', orgId)
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !discount) {
    throw new Error('Invalid discount code');
  }

  const now = new Date();
  const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
  const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

  if (startsAt && now < startsAt) {
    throw new Error('Discount code not yet active');
  }

  if (expiresAt && now > expiresAt) {
    throw new Error('Discount code expired');
  }

  if (discount.max_uses && (discount.uses_count || 0) >= discount.max_uses) {
    throw new Error('Discount code usage limit reached');
  }

  if (discount.min_purchase && subtotal < discount.min_purchase) {
    throw new Error(`Minimum purchase of €${discount.min_purchase} required`);
  }

  let discountAmount = 0;
  if (discount.type === 'percentage') {
    discountAmount = (subtotal * discount.value) / 100;
  } else {
    discountAmount = Math.min(discount.value, subtotal);
  }

  return {
    valid: true,
    code: discount.code,
    type: discount.type,
    value: discount.value,
    discount_amount: discountAmount,
    min_purchase: discount.min_purchase,
  };
}

// Main handler
Deno.serve(async (req) => {
  console.log(`[store-api] ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const action = params.get('action');
    const publicKey = params.get('public_key');

    // Get public key from body for POST requests
    let body: any = {};
    let bodyPublicKey = publicKey;

    if (req.method === 'POST') {
      try {
        body = await req.json();
        bodyPublicKey = body.public_key || publicKey;
      } catch {
        return errorResponse('INVALID_BODY', 'Invalid JSON body', 400);
      }
    }

    const finalPublicKey = bodyPublicKey;

    if (!finalPublicKey) {
      return errorResponse('MISSING_PUBLIC_KEY', 'public_key is required', 400);
    }

    if (!action) {
      return errorResponse('MISSING_ACTION', 'action parameter is required', 400);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get organization
    const org = await getOrganization(supabase, finalPublicKey);
    if (!org) {
      return errorResponse('INVALID_PUBLIC_KEY', 'Store not found', 404);
    }

    console.log(`[store-api] Action: ${action}, Org: ${org.name}`);

    let data: any;

    switch (action) {
      case 'products':
        data = await handleGetProducts(supabase, org.id, params);
        break;
      case 'product':
        data = await handleGetProduct(supabase, org.id, params);
        break;
      case 'categories':
        data = await handleGetCategories(supabase, org.id);
        break;
      case 'category':
        data = await handleGetCategory(supabase, org.id, params);
        break;
      case 'cart/validate':
        if (req.method !== 'POST') {
          return errorResponse('METHOD_NOT_ALLOWED', 'POST required', 405);
        }
        data = await handleValidateCart(supabase, org.id, body);
        break;
      case 'checkout':
        if (req.method !== 'POST') {
          return errorResponse('METHOD_NOT_ALLOWED', 'POST required', 405);
        }
        data = await handleCheckout(supabase, org.id, body);
        break;
      case 'customer/login':
        if (req.method !== 'POST') {
          return errorResponse('METHOD_NOT_ALLOWED', 'POST required', 405);
        }
        data = await handleCustomerLogin(supabase, org.id, body);
        break;
      case 'orders':
        data = await handleGetOrders(supabase, org.id, params);
        break;
      case 'discount/validate':
        if (req.method !== 'POST') {
          return errorResponse('METHOD_NOT_ALLOWED', 'POST required', 405);
        }
        data = await handleValidateDiscount(supabase, org.id, body);
        break;
      default:
        return errorResponse('INVALID_ACTION', `Unknown action: ${action}`, 400);
    }

    return jsonResponse({
      success: true,
      data,
      meta: {
        organization: org.name,
        currency: 'EUR',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[store-api] Error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
});
