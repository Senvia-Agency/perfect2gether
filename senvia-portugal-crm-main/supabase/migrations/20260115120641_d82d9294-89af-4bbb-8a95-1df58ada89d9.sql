-- Criar nova tabela ecommerce_products (completamente separada)
CREATE TABLE public.ecommerce_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  short_description TEXT,
  sku TEXT,
  price NUMERIC,
  compare_at_price NUMERIC,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  weight_grams INTEGER,
  is_digital BOOLEAN DEFAULT false,
  requires_shipping BOOLEAN DEFAULT true,
  track_inventory BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migrar dados existentes de products onde is_ecommerce = true
INSERT INTO public.ecommerce_products (
  id, organization_id, name, slug, description, short_description, sku, price,
  compare_at_price, category_id, weight_grams, is_digital, requires_shipping,
  track_inventory, stock_quantity, low_stock_threshold, tags, is_active, created_at, updated_at
)
SELECT 
  id, organization_id, name, slug, description, short_description, sku, price,
  compare_at_price, category_id, weight_grams, is_digital, requires_shipping,
  track_inventory, stock_quantity, low_stock_threshold, tags, is_active, created_at, updated_at
FROM public.products 
WHERE is_ecommerce = true;

-- Atualizar foreign keys para apontar para ecommerce_products
ALTER TABLE public.product_images 
  DROP CONSTRAINT IF EXISTS product_images_product_id_fkey;
ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES ecommerce_products(id) ON DELETE CASCADE;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES ecommerce_products(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES ecommerce_products(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES ecommerce_products(id) ON DELETE SET NULL;

-- Remover produtos e-commerce da tabela products original
DELETE FROM public.products WHERE is_ecommerce = true;

-- Enable RLS
ALTER TABLE public.ecommerce_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ecommerce_products
CREATE POLICY "Super admin full access ecommerce_products" 
ON public.ecommerce_products 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users view org ecommerce products" 
ON public.ecommerce_products 
FOR SELECT 
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org ecommerce products" 
ON public.ecommerce_products 
FOR ALL 
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_ecommerce_products_updated_at
BEFORE UPDATE ON public.ecommerce_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();