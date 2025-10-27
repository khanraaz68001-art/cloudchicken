-- 🐔 CHICKEN DELIVERY SYSTEM - COMPLETE DATABASE SETUP
-- Run this script in your Supabase SQL editor to set up the entire system

-- =====================================================
-- 1. AUTHENTICATION & USER MANAGEMENT
-- =====================================================

-- Create user profiles table for custom authentication
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'kitchen', 'delivery', 'customer')) DEFAULT 'customer',
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. ENHANCED STOCK MANAGEMENT SYSTEM
-- =====================================================

-- Stock batches (admin adds these)
CREATE TABLE IF NOT EXISTS public.stock_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number SERIAL UNIQUE,
  total_weight_kg DECIMAL(6,2) NOT NULL,
  total_chickens INTEGER NOT NULL,
  source TEXT NOT NULL, -- farm name or supplier
  received_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual chickens within each batch
CREATE TABLE IF NOT EXISTS public.individual_chickens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.stock_batches(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  initial_weight_kg DECIMAL(5,2) NOT NULL,
  current_weight_kg DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('available', 'butchered', 'sold', 'trashed')) DEFAULT 'available',
  source TEXT NOT NULL,
  received_date DATE DEFAULT CURRENT_DATE,
  butchered_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. PRODUCT MANAGEMENT (ECOMMERCE)
-- =====================================================

-- Product categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products (what customers can buy)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_per_kg DECIMAL(8,2) NOT NULL,
  category_id UUID REFERENCES public.product_categories(id),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Butchered meat inventory
CREATE TABLE IF NOT EXISTS public.butchered_meat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  individual_chicken_id UUID REFERENCES public.individual_chickens(id),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('available', 'sold', 'reserved', 'trashed')) DEFAULT 'available',
  butchered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ORDER MANAGEMENT
-- =====================================================

-- Customer orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.user_profiles(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')) DEFAULT 'pending',
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity_kg DECIMAL(5,2) NOT NULL,
  price_per_kg DECIMAL(8,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. ENHANCED WASTE MANAGEMENT
-- =====================================================

-- Drop existing waste functions and table
DROP FUNCTION IF EXISTS public.record_waste(TEXT, UUID, DECIMAL, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.record_waste(TEXT, UUID, DECIMAL, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_waste_summary();
DROP TABLE IF EXISTS public.enhanced_waste_records CASCADE;

-- Enhanced waste records with proper relationships
CREATE TABLE public.enhanced_waste_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT CHECK (source_type IN ('whole_chicken', 'butchered_meat')) NOT NULL,
  source_id UUID NOT NULL,
  individual_chicken_id UUID REFERENCES public.individual_chickens(id),
  butchered_meat_id UUID REFERENCES public.butchered_meat(id),
  waste_weight_kg DECIMAL(5,2) NOT NULL CHECK (waste_weight_kg > 0),
  waste_reason TEXT NOT NULL,
  waste_category TEXT CHECK (waste_category IN ('spoilage', 'damage', 'bones', 'excess_fat', 'contamination', 'processing_loss', 'other')) DEFAULT 'other',
  recorded_by UUID REFERENCES public.user_profiles(id) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    (source_type = 'whole_chicken' AND individual_chicken_id IS NOT NULL AND butchered_meat_id IS NULL) OR
    (source_type = 'butchered_meat' AND butchered_meat_id IS NOT NULL AND individual_chicken_id IS NULL)
  )
);

-- Stock summary for quick reporting
CREATE TABLE IF NOT EXISTS public.stock_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_chickens INTEGER DEFAULT 0,
  available_chickens INTEGER DEFAULT 0,
  total_weight_kg DECIMAL(8,2) DEFAULT 0,
  available_weight_kg DECIMAL(8,2) DEFAULT 0,
  butchered_weight_kg DECIMAL(8,2) DEFAULT 0,
  sold_weight_kg DECIMAL(8,2) DEFAULT 0,
  waste_weight_kg DECIMAL(8,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. DATABASE FUNCTIONS
-- =====================================================

-- Function to add a stock batch with individual chickens
CREATE OR REPLACE FUNCTION public.add_stock_batch(
  p_total_weight_kg DECIMAL,
  p_total_chickens INTEGER,
  p_source TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, message TEXT, batch_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_batch_id UUID;
  batch_num INTEGER;
  chicken_weight DECIMAL;
  i INTEGER;
BEGIN
  -- Calculate average weight per chicken
  chicken_weight := p_total_weight_kg / p_total_chickens;
  
  -- Insert new batch
  INSERT INTO public.stock_batches (total_weight_kg, total_chickens, source, notes)
  VALUES (p_total_weight_kg, p_total_chickens, p_source, p_notes)
  RETURNING id, batch_number INTO new_batch_id, batch_num;
  
  -- Create individual chickens
  FOR i IN 1..p_total_chickens LOOP
    INSERT INTO public.individual_chickens (
      batch_id, batch_number, initial_weight_kg, current_weight_kg, source
    ) VALUES (
      new_batch_id, 'BATCH-' || batch_num, chicken_weight, chicken_weight, p_source
    );
  END LOOP;
  
  -- Update stock summary
  PERFORM update_stock_summary();
  
  RETURN QUERY SELECT TRUE, 'Stock batch added successfully', new_batch_id;
END;
$$;

-- Function to butcher a chicken into products
CREATE OR REPLACE FUNCTION public.butcher_chicken(
  p_chicken_id UUID,
  p_products JSONB -- Array of {product_id, product_name, weight_kg}
) RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  chicken_record RECORD;
  product_record JSONB;
  total_butchered_weight DECIMAL := 0;
BEGIN
  -- Get chicken details
  SELECT * INTO chicken_record FROM public.individual_chickens WHERE id = p_chicken_id;
  
  IF chicken_record.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Chicken not found';
    RETURN;
  END IF;
  
  IF chicken_record.status != 'available' THEN
    RETURN QUERY SELECT FALSE, 'Chicken is not available for butchering';
    RETURN;
  END IF;
  
  -- Process each product
  FOR product_record IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    INSERT INTO public.butchered_meat (
      individual_chicken_id,
      product_id,
      product_name,
      weight_kg
    ) VALUES (
      p_chicken_id,
      (product_record->>'product_id')::UUID,
      product_record->>'product_name',
      (product_record->>'weight_kg')::DECIMAL
    );
    
    total_butchered_weight := total_butchered_weight + (product_record->>'weight_kg')::DECIMAL;
  END LOOP;
  
  -- Update chicken status and weight
  UPDATE public.individual_chickens 
  SET 
    status = 'butchered',
    current_weight_kg = current_weight_kg - total_butchered_weight,
    butchered_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = p_chicken_id;
  
  -- Update stock summary
  PERFORM update_stock_summary();
  
  RETURN QUERY SELECT TRUE, 'Chicken butchered successfully';
END;
$$;

-- Function to record waste
CREATE OR REPLACE FUNCTION public.record_waste(
    p_source_type TEXT,
    p_source_id UUID,
    p_waste_weight_kg DECIMAL,
    p_waste_reason TEXT,
    p_recorded_by UUID,
    p_waste_category TEXT DEFAULT 'other'
) RETURNS TABLE(success BOOLEAN, message TEXT, waste_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    source_weight DECIMAL;
    source_status TEXT;
    new_waste_id UUID;
BEGIN
    -- Validate source and update accordingly
    IF p_source_type = 'whole_chicken' THEN
        SELECT current_weight_kg, status INTO source_weight, source_status
        FROM public.individual_chickens WHERE id = p_source_id;
        
        IF source_weight IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Chicken not found', NULL::UUID;
            RETURN;
        END IF;
        
        -- Update chicken weight/status
        IF p_waste_weight_kg >= source_weight THEN
            UPDATE public.individual_chickens 
            SET status = 'trashed', current_weight_kg = 0, updated_at = NOW()
            WHERE id = p_source_id;
        ELSE
            UPDATE public.individual_chickens 
            SET current_weight_kg = current_weight_kg - p_waste_weight_kg, updated_at = NOW()
            WHERE id = p_source_id;
        END IF;
        
    ELSIF p_source_type = 'butchered_meat' THEN
        SELECT weight_kg, status INTO source_weight, source_status
        FROM public.butchered_meat WHERE id = p_source_id;
        
        IF source_weight IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Butchered meat not found', NULL::UUID;
            RETURN;
        END IF;
        
        -- Update meat weight/status
        IF p_waste_weight_kg >= source_weight THEN
            UPDATE public.butchered_meat 
            SET status = 'trashed', weight_kg = 0, updated_at = NOW()
            WHERE id = p_source_id;
        ELSE
            UPDATE public.butchered_meat 
            SET weight_kg = weight_kg - p_waste_weight_kg, updated_at = NOW()
            WHERE id = p_source_id;
        END IF;
    END IF;
    
    -- Record the waste
    INSERT INTO public.enhanced_waste_records (
        source_type, source_id, individual_chicken_id, butchered_meat_id,
        waste_weight_kg, waste_reason, waste_category, recorded_by
    ) VALUES (
        p_source_type, p_source_id,
        CASE WHEN p_source_type = 'whole_chicken' THEN p_source_id ELSE NULL END,
        CASE WHEN p_source_type = 'butchered_meat' THEN p_source_id ELSE NULL END,
        p_waste_weight_kg, p_waste_reason, p_waste_category, p_recorded_by
    ) RETURNING id INTO new_waste_id;
    
    PERFORM update_stock_summary();
    RETURN QUERY SELECT TRUE, 'Waste recorded successfully', new_waste_id;
END;
$$;

-- Function to update stock summary
CREATE OR REPLACE FUNCTION public.update_stock_summary()
RETURNS VOID
AS $$
BEGIN
  -- If a stock_summary row exists, update it; otherwise insert a new one
  IF EXISTS (SELECT 1 FROM public.stock_summary) THEN
    -- Update the existing single summary row; require a WHERE clause to satisfy editors/policy
    UPDATE public.stock_summary SET
      -- counts (both naming variants to avoid schema mismatch errors)
      total_chickens = (SELECT COUNT(*) FROM public.individual_chickens),
      total_chickens_count = (SELECT COUNT(*) FROM public.individual_chickens),
      available_chickens = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'available'),
      available_chickens_count = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'available'),
      butchered_chickens = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'butchered'),
      butchered_chickens_count = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'butchered'),
      -- weight columns
      total_weight_kg = (SELECT COALESCE(SUM(initial_weight_kg), 0) FROM public.individual_chickens),
      available_weight_kg = (SELECT COALESCE(SUM(current_weight_kg), 0) FROM public.individual_chickens WHERE status = 'available'),
      butchered_weight_kg = COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'available'), 0),
      sold_weight_kg = COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'sold'), 0),
      waste_weight_kg = COALESCE((SELECT SUM(waste_weight_kg) FROM public.enhanced_waste_records), 0),
      last_updated = NOW()
    WHERE id = (SELECT id FROM public.stock_summary LIMIT 1);
  ELSE
    INSERT INTO public.stock_summary (
      total_chickens,
      total_chickens_count,
      available_chickens,
      available_chickens_count,
      butchered_chickens,
      butchered_chickens_count,
      total_weight_kg,
      available_weight_kg,
      butchered_weight_kg,
      sold_weight_kg,
      waste_weight_kg,
      last_updated
    )
    SELECT 
      COUNT(*)::INT,
      COUNT(*)::INT,
      COUNT(CASE WHEN status = 'available' THEN 1 END)::INT,
      COUNT(CASE WHEN status = 'available' THEN 1 END)::INT,
      COUNT(CASE WHEN status = 'butchered' THEN 1 END)::INT,
      COUNT(CASE WHEN status = 'butchered' THEN 1 END)::INT,
      COALESCE(SUM(initial_weight_kg), 0),
      COALESCE(SUM(CASE WHEN status = 'available' THEN current_weight_kg ELSE 0 END), 0),
      COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'available'), 0),
      COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'sold'), 0),
      COALESCE((SELECT SUM(waste_weight_kg) FROM public.enhanced_waste_records), 0),
      NOW()
    FROM public.individual_chickens;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get waste summary
CREATE OR REPLACE FUNCTION public.get_waste_summary()
RETURNS TABLE(
    total_waste_kg DECIMAL,
    chicken_waste_kg DECIMAL,
    butchered_waste_kg DECIMAL,
    waste_percentage DECIMAL,
    records_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(waste_weight_kg), 0) as total_waste_kg,
        COALESCE(SUM(CASE WHEN source_type = 'whole_chicken' THEN waste_weight_kg ELSE 0 END), 0) as chicken_waste_kg,
        COALESCE(SUM(CASE WHEN source_type = 'butchered_meat' THEN waste_weight_kg ELSE 0 END), 0) as butchered_waste_kg,
        CASE 
            WHEN (SELECT SUM(initial_weight_kg) FROM individual_chickens) > 0 
            THEN (COALESCE(SUM(waste_weight_kg), 0) / (SELECT SUM(initial_weight_kg) FROM individual_chickens)) * 100
            ELSE 0
        END as waste_percentage,
        COUNT(*) as records_count
    FROM public.enhanced_waste_records;
END;
$$;

-- =====================================================
-- 7. SAMPLE DATA
-- =====================================================

-- Insert admin user (replace with your phone/password)
INSERT INTO public.user_profiles (phone, password_hash, full_name, role, address) VALUES 
('admin', 'admin123', 'System Administrator', 'admin', 'Main Office'),
('kitchen', 'kitchen123', 'Kitchen Manager', 'kitchen', 'Kitchen'),
('delivery', 'delivery123', 'Delivery Manager', 'delivery', 'Delivery Center')
ON CONFLICT (phone) DO NOTHING;

-- Sample product categories
INSERT INTO public.product_categories (name, description) VALUES 
('Fresh Chicken', 'Fresh chicken cuts and whole chickens'),
('Processed Meat', 'Marinated and processed chicken products'),
('Organic', 'Organic and free-range chicken products')
ON CONFLICT (name) DO NOTHING;

-- Sample products
DO $$
DECLARE
    fresh_category_id UUID;
    processed_category_id UUID;
    organic_category_id UUID;
BEGIN
    SELECT id INTO fresh_category_id FROM public.product_categories WHERE name = 'Fresh Chicken' LIMIT 1;
    SELECT id INTO processed_category_id FROM public.product_categories WHERE name = 'Processed Meat' LIMIT 1;
    SELECT id INTO organic_category_id FROM public.product_categories WHERE name = 'Organic' LIMIT 1;
    
    INSERT INTO public.products (name, description, price_per_kg, category_id) VALUES 
    ('Whole Chicken', 'Fresh whole chicken', 250.00, fresh_category_id),
    ('Chicken Breast', 'Boneless chicken breast', 450.00, fresh_category_id),
    ('Chicken Thigh', 'Fresh chicken thigh with bone', 320.00, fresh_category_id),
    ('Chicken Wings', 'Fresh chicken wings', 280.00, fresh_category_id),
    ('Marinated Tikka', 'Chicken tikka marinated', 500.00, processed_category_id),
    ('Organic Whole Chicken', 'Free-range organic chicken', 380.00, organic_category_id)
    ON CONFLICT DO NOTHING;
END $$;

-- =====================================================
-- 8. PERMISSIONS & SECURITY
-- =====================================================

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_chickens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.butchered_meat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_summary ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users for now)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
        AND tablename IN ('user_profiles', 'stock_batches', 'individual_chickens', 'product_categories', 'products', 'butchered_meat', 'orders', 'order_items', 'enhanced_waste_records', 'stock_summary')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Allow all for authenticated users" ON public.%I FOR ALL USING (auth.role() = ''authenticated'')', tbl);
    END LOOP;
END $$;

-- =====================================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_individual_chickens_batch_id ON public.individual_chickens(batch_id);
CREATE INDEX IF NOT EXISTS idx_individual_chickens_status ON public.individual_chickens(status);
CREATE INDEX IF NOT EXISTS idx_butchered_meat_chicken_id ON public.butchered_meat(individual_chicken_id);
CREATE INDEX IF NOT EXISTS idx_butchered_meat_product_id ON public.butchered_meat(product_id);
CREATE INDEX IF NOT EXISTS idx_butchered_meat_status ON public.butchered_meat(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_waste_records_individual_chicken ON public.enhanced_waste_records(individual_chicken_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_waste_records_butchered_meat ON public.enhanced_waste_records(butchered_meat_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_waste_records_recorded_at ON public.enhanced_waste_records(recorded_at DESC);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '🐔 CHICKEN DELIVERY SYSTEM SETUP COMPLETE! 🐔';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Authentication system ready';
    RAISE NOTICE '✅ Enhanced stock management with individual chicken tracking';
    RAISE NOTICE '✅ Product catalog and ecommerce system';
    RAISE NOTICE '✅ Order management system';
    RAISE NOTICE '✅ Comprehensive waste management';
    RAISE NOTICE '✅ All database functions created';
    RAISE NOTICE '✅ Sample data inserted';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready to test the complete workflow:';
    RAISE NOTICE '1. Admin adds stock batch (20kg with 10 chickens)';
    RAISE NOTICE '2. Kitchen butchers chickens (18kg remaining after 2kg butchered)';
    RAISE NOTICE '3. Customers order from ecommerce menu';
    RAISE NOTICE '4. Waste management tracks all waste';
    RAISE NOTICE '5. Delivery fulfills orders';
END $$;