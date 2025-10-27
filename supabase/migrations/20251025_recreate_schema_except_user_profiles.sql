-- Migration: Recreate schema (drop all tables except user_profiles) and create fresh, consistent schema
-- Run this in Supabase SQL editor for a clean reset of the app schema.

BEGIN;

-- Drop objects that we will recreate (skip user_profiles)
DROP VIEW IF EXISTS public.products_with_image CASCADE;

-- Drop functions we'll recreate
DROP FUNCTION IF EXISTS public.upload_product_image(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.add_stock_batch(DECIMAL[], TEXT);
DROP FUNCTION IF EXISTS public.butcher_chicken(UUID, UUID);
DROP FUNCTION IF EXISTS public.update_stock_summary();

-- Drop tables (except user_profiles)
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.butchered_meat CASCADE;
DROP TABLE IF EXISTS public.individual_chickens CASCADE;
DROP TABLE IF EXISTS public.stock_batches CASCADE;
DROP TABLE IF EXISTS public.stock_summary CASCADE;
DROP TABLE IF EXISTS public.enhanced_waste_records CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;

-- =====================================================
-- 1. Product categories
-- =====================================================
CREATE TABLE public.product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Products (store images in DB as bytea for simplicity)
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  owner_id UUID NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  image_data BYTEA,
  image_mime TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Stock batches and individual chickens
CREATE TABLE public.stock_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT UNIQUE,
  total_weight_kg DECIMAL(8,2) DEFAULT 0,
  total_chickens INTEGER DEFAULT 0,
  source TEXT,
  received_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.individual_chickens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.stock_batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  initial_weight_kg DECIMAL(6,2) NOT NULL DEFAULT 0,
  current_weight_kg DECIMAL(6,2) NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('available','butchered','sold','trashed')) DEFAULT 'available',
  received_date DATE DEFAULT CURRENT_DATE,
  butchered_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Butchered meat records
CREATE TABLE public.butchered_meat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  individual_chicken_id UUID REFERENCES public.individual_chickens(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  weight_kg DECIMAL(6,2) NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('available','sold','reserved','trashed')) DEFAULT 'available',
  butchered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Orders and order items (normalized)
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  customer_phone TEXT,
  customer_name TEXT,
  customer_address TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending','confirmed','preparing','ready','delivered','cancelled')) DEFAULT 'pending',
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 0,
  price_per_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enhanced waste records
CREATE TABLE public.enhanced_waste_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT CHECK (source_type IN ('whole_chicken','butchered_meat')) NOT NULL,
  source_id UUID NOT NULL,
  individual_chicken_id UUID REFERENCES public.individual_chickens(id) ON DELETE SET NULL,
  butchered_meat_id UUID REFERENCES public.butchered_meat(id) ON DELETE SET NULL,
  waste_weight_kg DECIMAL(6,2) NOT NULL CHECK (waste_weight_kg > 0),
  waste_reason TEXT NOT NULL,
  waste_category TEXT CHECK (waste_category IN ('spoilage','damage','bones','excess_fat','contamination','processing_loss','other')) DEFAULT 'other',
  recorded_by UUID REFERENCES public.user_profiles(id) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Stock summary (single row)
CREATE TABLE public.stock_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_chickens INTEGER DEFAULT 0,
  available_chickens INTEGER DEFAULT 0,
  butchered_chickens INTEGER DEFAULT 0,
  total_weight_kg DECIMAL(10,2) DEFAULT 0,
  available_weight_kg DECIMAL(10,2) DEFAULT 0,
  butchered_weight_kg DECIMAL(10,2) DEFAULT 0,
  sold_weight_kg DECIMAL(10,2) DEFAULT 0,
  waste_weight_kg DECIMAL(10,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ensure a single row exists
INSERT INTO public.stock_summary (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.stock_summary);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- update_stock_summary: calculates all aggregates and updates the single summary row
CREATE OR REPLACE FUNCTION public.update_stock_summary()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stock_summary) THEN
    UPDATE public.stock_summary SET
      total_chickens = (SELECT COUNT(*) FROM public.individual_chickens),
      available_chickens = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'available'),
      butchered_chickens = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'butchered'),
      total_weight_kg = COALESCE((SELECT SUM(initial_weight_kg) FROM public.individual_chickens), 0),
      available_weight_kg = COALESCE((SELECT SUM(current_weight_kg) FROM public.individual_chickens WHERE status = 'available'), 0),
      butchered_weight_kg = COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'available'), 0),
      sold_weight_kg = COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'sold'), 0),
      waste_weight_kg = COALESCE((SELECT SUM(waste_weight_kg) FROM public.enhanced_waste_records), 0),
      last_updated = NOW()
    WHERE id = (SELECT id FROM public.stock_summary LIMIT 1);
  ELSE
    INSERT INTO public.stock_summary (
      total_chickens, available_chickens, butchered_chickens, total_weight_kg, available_weight_kg, butchered_weight_kg, sold_weight_kg, waste_weight_kg, last_updated
    )
    SELECT
      COUNT(*),
      COUNT(CASE WHEN status = 'available' THEN 1 END),
      COUNT(CASE WHEN status = 'butchered' THEN 1 END),
      COALESCE(SUM(initial_weight_kg), 0),
      COALESCE(SUM(CASE WHEN status = 'available' THEN current_weight_kg ELSE 0 END), 0),
      COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'available'), 0),
      COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'sold'), 0),
      COALESCE((SELECT SUM(waste_weight_kg) FROM public.enhanced_waste_records), 0),
      NOW()
    FROM public.individual_chickens;
  END IF;
END;
$$;

-- add_stock_batch: insert batch and individual chickens
CREATE OR REPLACE FUNCTION public.add_stock_batch(p_chicken_weights DECIMAL[], p_batch_name TEXT DEFAULT NULL)
RETURNS TABLE(success BOOLEAN, message TEXT, batch_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  new_batch_id UUID;
  batch_num TEXT;
  w DECIMAL;
BEGIN
  IF p_batch_name IS NULL THEN
    batch_num := 'BATCH_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MI');
  ELSE
    batch_num := p_batch_name;
  END IF;

  INSERT INTO public.stock_batches (batch_number, total_weight_kg, total_chickens, source)
  VALUES (batch_num, COALESCE((SELECT SUM(x) FROM unnest(p_chicken_weights) AS x),0), array_length(p_chicken_weights,1), NULL)
  RETURNING id INTO new_batch_id;

  FOREACH w IN ARRAY p_chicken_weights LOOP
    INSERT INTO public.individual_chickens (batch_id, batch_number, initial_weight_kg, current_weight_kg)
    VALUES (new_batch_id, batch_num, w, w);
  END LOOP;

  PERFORM public.update_stock_summary();
  RETURN QUERY SELECT TRUE, 'Batch added', new_batch_id;
END;
$$;

-- Compatibility overload: accept (batch_name, chicken_weights) ordering used by some clients
CREATE OR REPLACE FUNCTION public.add_stock_batch(p_batch_name TEXT, p_chicken_weights DECIMAL[])
RETURNS TABLE(success BOOLEAN, message TEXT, batch_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Delegate to the canonical implementation which takes (chicken_weights, batch_name)
  RETURN QUERY SELECT * FROM public.add_stock_batch(p_chicken_weights, p_batch_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_stock_batch(TEXT, DECIMAL[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_stock_batch(TEXT, DECIMAL[]) TO public;

-- Compatibility wrapper with exact parameter names expected by some clients (batch_name, chicken_weights)
-- If a function with the same signature exists, drop it first to avoid
-- "cannot change name of input parameter" errors when parameter names differ.
DROP FUNCTION IF EXISTS public.add_stock_batch(TEXT, DECIMAL[]);
CREATE FUNCTION public.add_stock_batch(batch_name TEXT, chicken_weights DECIMAL[])
RETURNS TABLE(success BOOLEAN, message TEXT, batch_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Delegate to canonical function (chicken_weights, batch_name)
  RETURN QUERY SELECT * FROM public.add_stock_batch(chicken_weights, batch_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_stock_batch(TEXT, DECIMAL[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_stock_batch(TEXT, DECIMAL[]) TO public;

-- Internal implementation for butcher_chicken. We create an internal function with stable parameter names
-- and then expose a wrapper with the parameter names that PostgREST/Supabase expects (chicken_id, target_product_id).
CREATE OR REPLACE FUNCTION public._butcher_chicken_impl(p_chicken_id UUID, p_target_product_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  chicken_weight DECIMAL;
  new_meat_id UUID;
BEGIN
  SELECT current_weight_kg INTO chicken_weight FROM public.individual_chickens WHERE id = p_chicken_id AND status = 'available';
  IF chicken_weight IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Chicken not found or not available';
    RETURN;
  END IF;

  UPDATE public.individual_chickens SET status = 'butchered', butchered_date = NOW(), updated_at = NOW() WHERE id = p_chicken_id;

  INSERT INTO public.butchered_meat (individual_chicken_id, product_id, product_name, weight_kg, status)
  VALUES (p_chicken_id, p_target_product_id, (SELECT name FROM public.products WHERE id = p_target_product_id), chicken_weight, 'available')
  RETURNING id INTO new_meat_id;

  PERFORM public.update_stock_summary();
  RETURN QUERY SELECT TRUE, 'Chicken butchered successfully';
END;
$$;

-- Ensure a wrapper exists with the exact parameter names some clients expect
DROP FUNCTION IF EXISTS public.butcher_chicken(UUID, UUID);
CREATE FUNCTION public.butcher_chicken(chicken_id UUID, target_product_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public._butcher_chicken_impl(chicken_id, target_product_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public._butcher_chicken_impl(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.butcher_chicken(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.butcher_chicken(UUID, UUID) TO public;

-- upload_product_image: store image bytes into products.image_data
CREATE OR REPLACE FUNCTION public.upload_product_image(p_product_id UUID, p_image_base64 TEXT, p_image_mime TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products
  SET image_data = decode(p_image_base64, 'base64'),
      image_mime = p_image_mime,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- create view products_with_image
CREATE OR REPLACE VIEW public.products_with_image AS
SELECT p.*, encode(p.image_data, 'base64') AS image_base64, pc.name AS category_name
FROM public.products p
LEFT JOIN public.product_categories pc ON p.category_id = pc.id;

GRANT SELECT ON public.products_with_image TO public;

-- =====================================================
-- TRIGGERS
-- =====================================================
-- trigger to update stock_summary after chickens / butchered meat / waste changes
CREATE OR REPLACE FUNCTION public.trigger_update_stock_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_stock_summary();
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_individual_chickens_stock_update AFTER INSERT OR UPDATE OR DELETE ON public.individual_chickens FOR EACH ROW EXECUTE FUNCTION public.trigger_update_stock_summary();
CREATE TRIGGER trg_butchered_meat_stock_update AFTER INSERT OR UPDATE OR DELETE ON public.butchered_meat FOR EACH ROW EXECUTE FUNCTION public.trigger_update_stock_summary();
CREATE TRIGGER trg_enhanced_waste_stock_update AFTER INSERT OR UPDATE OR DELETE ON public.enhanced_waste_records FOR EACH ROW EXECUTE FUNCTION public.trigger_update_stock_summary();

-- =====================================================
-- RLS policies (development-friendly, tighten in production)
-- =====================================================
-- Enable RLS where appropriate
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_chickens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.butchered_meat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_summary ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and create permissive authenticated policies (explicit statements to avoid anonymous DO block)

-- products
DROP POLICY IF EXISTS "Allow all authenticated on products" ON public.products;
CREATE POLICY "Allow all authenticated on products" ON public.products FOR ALL USING (auth.role() IN ('authenticated','anon'));

-- product_categories
DROP POLICY IF EXISTS "Allow all authenticated on product_categories" ON public.product_categories;
CREATE POLICY "Allow all authenticated on product_categories" ON public.product_categories FOR ALL USING (auth.role() IN ('authenticated','anon'));

-- individual_chickens
DROP POLICY IF EXISTS "Allow all authenticated on individual_chickens" ON public.individual_chickens;
CREATE POLICY "Allow all authenticated on individual_chickens" ON public.individual_chickens FOR ALL USING (auth.role() IN ('authenticated','anon'));

-- orders
DROP POLICY IF EXISTS "Allow all authenticated on orders" ON public.orders;
CREATE POLICY "Allow all authenticated on orders" ON public.orders FOR ALL USING (auth.role() IN ('authenticated','anon'));

-- order_items
DROP POLICY IF EXISTS "Allow all authenticated on order_items" ON public.order_items;
CREATE POLICY "Allow all authenticated on order_items" ON public.order_items FOR ALL USING (auth.role() IN ('authenticated','anon'));

-- stock_summary
DROP POLICY IF EXISTS "Allow all authenticated on stock_summary" ON public.stock_summary;
CREATE POLICY "Allow all authenticated on stock_summary" ON public.stock_summary FOR ALL USING (auth.role() IN ('authenticated','anon'));

-- Grant execute on functions to authenticated role
GRANT EXECUTE ON FUNCTION public.update_stock_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_stock_batch(DECIMAL[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.butcher_chicken(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_product_image(UUID, TEXT, TEXT) TO authenticated;

-- Safety ALTERs: ensure missing columns/constraints exist for existing installs
-- add is_active to product_categories if missing (frontend filters on this)
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ensure orders.product_id exists and has FK to products(id) so PostgREST can detect relationship
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_id UUID;

-- recreate/drop FK safely
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_product_id;
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_product_id FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- ensure butchered_meat.weight_kg exists (some older schemas used different column names)
ALTER TABLE public.butchered_meat
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,2) DEFAULT 0;

-- ensure product_categories.sort_order exists (some older schemas lacked it)
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ensure order_items has a butchered_meat relationship for PostgREST schema detection
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS butchered_meat_id UUID;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_butchered_meat_id;
ALTER TABLE public.order_items
  ADD CONSTRAINT fk_order_items_butchered_meat_id FOREIGN KEY (butchered_meat_id) REFERENCES public.butchered_meat(id) ON DELETE SET NULL;

-- ensure orders has a butchered_meat relationship if some clients expect direct relation
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS butchered_meat_id UUID;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_butchered_meat_id;
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_butchered_meat_id FOREIGN KEY (butchered_meat_id) REFERENCES public.butchered_meat(id) ON DELETE SET NULL;

-- ensure individual_chickens.weight_kg exists for compatibility with older queries
ALTER TABLE public.individual_chickens
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,2) DEFAULT 0;

-- populate weight_kg from current_weight_kg (or initial_weight_kg if current missing)
UPDATE public.individual_chickens SET weight_kg = COALESCE(current_weight_kg, initial_weight_kg, 0);

-- create trigger to keep weight_kg in sync with current_weight_kg
CREATE OR REPLACE FUNCTION public.sync_individual_chicken_weight()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.weight_kg := COALESCE(NEW.current_weight_kg, NEW.initial_weight_kg, NEW.weight_kg);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_weight_on_individual_chickens ON public.individual_chickens;
CREATE TRIGGER trg_sync_weight_on_individual_chickens
BEFORE INSERT OR UPDATE ON public.individual_chickens
FOR EACH ROW EXECUTE FUNCTION public.sync_individual_chicken_weight();

-- ensure stock_summary has compatibility count columns some clients expect
ALTER TABLE public.stock_summary
  ADD COLUMN IF NOT EXISTS available_chickens_count INTEGER DEFAULT 0;
ALTER TABLE public.stock_summary
  ADD COLUMN IF NOT EXISTS total_chickens_count INTEGER DEFAULT 0;
ALTER TABLE public.stock_summary
  ADD COLUMN IF NOT EXISTS butchered_chickens_count INTEGER DEFAULT 0;

-- populate counts from existing fields
UPDATE public.stock_summary SET
  available_chickens_count = COALESCE(available_chickens, 0),
  total_chickens_count = COALESCE(total_chickens, 0);
UPDATE public.stock_summary SET butchered_chickens_count = COALESCE(butchered_chickens, 0);

-- trigger to keep count aliases in sync
CREATE OR REPLACE FUNCTION public.sync_stock_summary_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.available_chickens_count := COALESCE(NEW.available_chickens, 0);
  NEW.total_chickens_count := COALESCE(NEW.total_chickens, 0);
  NEW.butchered_chickens_count := COALESCE(NEW.butchered_chickens, 0);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_stock_summary_counts ON public.stock_summary;
CREATE TRIGGER trg_sync_stock_summary_counts
BEFORE INSERT OR UPDATE ON public.stock_summary
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_summary_counts();

-- ensure orders.user_id exists (some code expects user_id instead of customer_id)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- copy from customer_id if present
UPDATE public.orders SET user_id = customer_id WHERE user_id IS NULL AND customer_id IS NOT NULL;

-- FK to user_profiles
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_user_id;
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Remove ambiguous FK on customer_id so PostgREST doesn't find multiple relationships
-- keep the column for backward compatibility but remove the FK if present
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_customer_id;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS customer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS customer_fk;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customerid_fkey;

COMMIT;
