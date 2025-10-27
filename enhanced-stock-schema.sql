-- Enhanced Database Schema for Stock Management and Product System
-- Run this after the complete-custom-auth-schema.sql

-- 1. Enhanced stock tracking with individual chickens
DROP TABLE IF EXISTS public.individual_chickens CASCADE;
CREATE TABLE public.individual_chickens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  weight_kg DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('available', 'butchered', 'reserved')) DEFAULT 'available',
  batch_number TEXT, -- For tracking different deliveries
  received_date DATE DEFAULT CURRENT_DATE,
  butchered_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enhanced categories for products (not just chicken weights)
DROP TABLE IF EXISTS public.product_categories CASCADE;
CREATE TABLE public.product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., "Fresh Chicken", "Marinated Chicken", "Chicken Parts"
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Products table (individual products with photos)
DROP TABLE IF EXISTS public.products CASCADE;
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.product_categories(id) NOT NULL,
  name TEXT NOT NULL, -- e.g., "Whole Chicken", "Chicken Breast", "Tandoori Chicken"
  description TEXT,
  base_price_per_kg DECIMAL(8,2) NOT NULL,
  image_url TEXT, -- Photo URL from Supabase Storage
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Stock summary table (for quick reference)
DROP TABLE IF EXISTS public.stock_summary CASCADE;
CREATE TABLE public.stock_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_chickens_count INTEGER DEFAULT 0,
  total_weight_kg DECIMAL(8,2) DEFAULT 0,
  available_chickens_count INTEGER DEFAULT 0,
  available_weight_kg DECIMAL(8,2) DEFAULT 0,
  butchered_chickens_count INTEGER DEFAULT 0,
  butchered_weight_kg DECIMAL(8,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial stock summary record
INSERT INTO public.stock_summary (id) VALUES (gen_random_uuid());

-- 5. Update butchered_meat table to reference individual chickens
ALTER TABLE public.butchered_meat ADD COLUMN IF NOT EXISTS individual_chicken_id UUID REFERENCES public.individual_chickens(id);
ALTER TABLE public.butchered_meat DROP CONSTRAINT IF EXISTS butchered_meat_category_id_fkey;
ALTER TABLE public.butchered_meat ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- 6. Update orders table to reference products instead of just weight
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- 7. Create functions to update stock summary
CREATE OR REPLACE FUNCTION update_stock_summary()
RETURNS VOID AS $$
BEGIN
    UPDATE public.stock_summary SET
        total_chickens_count = (SELECT COUNT(*) FROM public.individual_chickens),
        total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM public.individual_chickens),
        available_chickens_count = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'available'),
        available_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM public.individual_chickens WHERE status = 'available'),
        butchered_chickens_count = (SELECT COUNT(*) FROM public.individual_chickens WHERE status = 'butchered'),
        butchered_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM public.individual_chickens WHERE status = 'butchered'),
        last_updated = NOW()
    WHERE id = (SELECT id FROM public.stock_summary LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger to update stock summary when chickens are modified
CREATE OR REPLACE FUNCTION trigger_update_stock_summary()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_stock_summary();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER individual_chickens_stock_update
    AFTER INSERT OR UPDATE OR DELETE ON public.individual_chickens
    FOR EACH ROW EXECUTE FUNCTION trigger_update_stock_summary();

-- 9. Create function to add stock batch
CREATE OR REPLACE FUNCTION add_stock_batch(
    chicken_weights DECIMAL[],
    batch_name TEXT DEFAULT NULL
)
RETURNS TABLE(
    total_chickens INTEGER,
    total_weight DECIMAL,
    batch_number TEXT
) AS $$
DECLARE
    chicken_weight DECIMAL;
    batch_num TEXT;
    chicken_count INTEGER := 0;
    total_kg DECIMAL := 0;
BEGIN
    -- Generate batch number if not provided
    IF batch_name IS NULL THEN
        batch_num := 'BATCH_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MI');
    ELSE
        batch_num := batch_name;
    END IF;
    
    -- Insert individual chickens
    FOREACH chicken_weight IN ARRAY chicken_weights
    LOOP
        INSERT INTO public.individual_chickens (weight_kg, batch_number)
        VALUES (chicken_weight, batch_num);
        
        chicken_count := chicken_count + 1;
        total_kg := total_kg + chicken_weight;
    END LOOP;
    
    -- Update stock summary
    PERFORM update_stock_summary();
    
    RETURN QUERY SELECT chicken_count, total_kg, batch_num;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to butcher a chicken
CREATE OR REPLACE FUNCTION butcher_chicken(
    chicken_id UUID,
    target_product_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    butchered_meat_id UUID
) AS $$
DECLARE
    new_meat_id UUID;
    chicken_weight DECIMAL;
BEGIN
    -- Check if chicken exists and is available
    SELECT weight_kg INTO chicken_weight
    FROM public.individual_chickens 
    WHERE id = chicken_id AND status = 'available';
    
    IF chicken_weight IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Chicken not found or not available', NULL::UUID;
        RETURN;
    END IF;
    
    -- Mark chicken as butchered
    UPDATE public.individual_chickens 
    SET status = 'butchered', 
        butchered_date = NOW(),
        updated_at = NOW()
    WHERE id = chicken_id;
    
    -- Create butchered meat record
    INSERT INTO public.butchered_meat (
        individual_chicken_id,
        product_id,
        weight_kg,
        status
    ) VALUES (
        chicken_id,
        target_product_id,
        chicken_weight,
        'available'
    ) RETURNING id INTO new_meat_id;
    
    -- Update stock summary
    PERFORM update_stock_summary();
    
    RETURN QUERY SELECT TRUE, 'Chicken successfully butchered', new_meat_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Insert sample product categories
INSERT INTO public.product_categories (name, description, sort_order) VALUES
('Fresh Whole Chicken', 'Complete fresh chickens ready for cooking', 1),
('Chicken Parts', 'Individual chicken parts and cuts', 2),
('Marinated Chicken', 'Pre-marinated chicken varieties', 3),
('Special Preparations', 'Specially prepared chicken items', 4)
ON CONFLICT (name) DO NOTHING;

-- 12. Insert sample products
INSERT INTO public.products (category_id, name, description, base_price_per_kg, sort_order) VALUES
(
    (SELECT id FROM public.product_categories WHERE name = 'Fresh Whole Chicken'),
    'Small Whole Chicken (1kg)',
    'Perfect for small families, tender and fresh',
    450.00,
    1
),
(
    (SELECT id FROM public.product_categories WHERE name = 'Fresh Whole Chicken'),
    'Medium Whole Chicken (1.5kg)',
    'Ideal for medium families, juicy and fresh',
    450.00,
    2
),
(
    (SELECT id FROM public.product_categories WHERE name = 'Fresh Whole Chicken'),
    'Large Whole Chicken (2kg)',
    'Great for large families or gatherings',
    450.00,
    3
),
(
    (SELECT id FROM public.product_categories WHERE name = 'Chicken Parts'),
    'Chicken Breast',
    'Boneless chicken breast, high in protein',
    550.00,
    1
),
(
    (SELECT id FROM public.product_categories WHERE name = 'Chicken Parts'),
    'Chicken Thighs',
    'Juicy chicken thighs, perfect for grilling',
    420.00,
    2
),
(
    (SELECT id FROM public.product_categories WHERE name = 'Marinated Chicken'),
    'Tandoori Chicken',
    'Marinated in authentic tandoori spices',
    500.00,
    1
)
ON CONFLICT DO NOTHING;

-- 13. Disable RLS for new tables
ALTER TABLE public.individual_chickens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_summary DISABLE ROW LEVEL SECURITY;

-- 14. Add sample stock for testing
SELECT add_stock_batch(ARRAY[2.0, 2.0, 2.0, 2.0, 2.0, 1.5, 1.5, 1.5, 1.5, 1.0, 1.0], 'INITIAL_STOCK');

-- Initial setup complete!
-- Total: 11 chickens, 18kg total weight
-- Available for butchering and orders