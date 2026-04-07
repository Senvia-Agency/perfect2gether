
-- =====================================================
-- SENVIA OS - E-COMMERCE MODULE - DATABASE FOUNDATION
-- =====================================================

-- 1. PRODUCT CATEGORIES
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org categories" ON public.product_categories
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org categories" ON public.product_categories
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access categories" ON public.product_categories
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2. EXTEND PRODUCTS TABLE
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER,
  ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_ecommerce BOOLEAN DEFAULT false;

-- 3. PRODUCT IMAGES
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view product images" ON public.product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_images.product_id 
      AND p.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Admins manage product images" ON public.product_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_images.product_id 
      AND p.organization_id = get_user_org_id(auth.uid())
    ) AND has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_images.product_id 
      AND p.organization_id = get_user_org_id(auth.uid())
    ) AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access product_images" ON public.product_images
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. PRODUCT VARIANTS
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  compare_at_price NUMERIC,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  weight_grams INTEGER,
  is_active BOOLEAN DEFAULT true,
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view product variants" ON public.product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_variants.product_id 
      AND p.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Admins manage product variants" ON public.product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_variants.product_id 
      AND p.organization_id = get_user_org_id(auth.uid())
    ) AND has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_variants.product_id 
      AND p.organization_id = get_user_org_id(auth.uid())
    ) AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access product_variants" ON public.product_variants
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. INVENTORY MOVEMENTS
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'return')),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org inventory movements" ON public.inventory_movements
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org inventory movements" ON public.inventory_movements
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access inventory_movements" ON public.inventory_movements
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 6. CUSTOMERS (External B2C customers)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  accepts_marketing BOOLEAN DEFAULT false,
  notes TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org customers" ON public.customers
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users insert org customers" ON public.customers
  FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org customers" ON public.customers
  FOR UPDATE USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org customers" ON public.customers
  FOR DELETE USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access customers" ON public.customers
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 7. CUSTOMER ADDRESSES
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing')),
  is_default BOOLEAN DEFAULT false,
  name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'PT',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view customer addresses" ON public.customer_addresses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_addresses.customer_id 
      AND c.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Users manage customer addresses" ON public.customer_addresses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_addresses.customer_id 
      AND c.organization_id = get_user_org_id(auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = customer_addresses.customer_id 
      AND c.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Super admin full access customer_addresses" ON public.customer_addresses
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 8. ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled')),
  
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_total NUMERIC DEFAULT 0,
  shipping_total NUMERIC DEFAULT 0,
  tax_total NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  
  discount_code TEXT,
  
  shipping_address JSONB,
  billing_address JSONB,
  
  notes TEXT,
  internal_notes TEXT,
  
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, order_number)
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org orders" ON public.orders
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users insert org orders" ON public.orders
  FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org orders" ON public.orders
  FOR UPDATE USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org orders" ON public.orders
  FOR DELETE USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access orders" ON public.orders
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 9. ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_items.order_id 
      AND o.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Users manage order items" ON public.order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_items.order_id 
      AND o.organization_id = get_user_org_id(auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_items.order_id 
      AND o.organization_id = get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Super admin full access order_items" ON public.order_items
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 10. SHIPMENTS
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'returned')),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org shipments" ON public.shipments
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users manage org shipments" ON public.shipments
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Super admin full access shipments" ON public.shipments
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 11. DISCOUNT CODES
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'free_shipping')),
  value NUMERIC NOT NULL,
  min_purchase NUMERIC,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org discount codes" ON public.discount_codes
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org discount codes" ON public.discount_codes
  FOR ALL USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access discount_codes" ON public.discount_codes
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 12. UPDATE TRIGGERS FOR updated_at
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. FUNCTION TO GENERATE ORDER NUMBER
CREATE OR REPLACE FUNCTION public.generate_order_number(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
  _number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO _count FROM public.orders WHERE organization_id = _org_id;
  _number := '#' || LPAD(_count::TEXT, 4, '0');
  RETURN _number;
END;
$$;

-- 14. CREATE STORAGE BUCKET FOR PRODUCT IMAGES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 
  'product-images', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their product images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

-- 15. UPDATE enabled_modules DEFAULT TO INCLUDE ECOMMERCE
ALTER TABLE public.organizations 
  ALTER COLUMN enabled_modules SET DEFAULT '{"calendar": true, "proposals": true, "sales": true, "ecommerce": false}'::jsonb;
