-- 🧹 SILENT DATA CLEANUP - Keep All Users, Clear All Data
-- This version runs quietly without verbose output to avoid JSON coercion issues

-- Clear all operational data safely (only if tables exist)
DO $$
BEGIN
    -- Clear tables in dependency order, but only if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enhanced_waste_records') THEN
        TRUNCATE TABLE public.enhanced_waste_records CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
        TRUNCATE TABLE public.order_items CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        TRUNCATE TABLE public.orders CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'butchered_meat') THEN
        TRUNCATE TABLE public.butchered_meat CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'individual_chickens') THEN
        TRUNCATE TABLE public.individual_chickens CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_batches') THEN
        TRUNCATE TABLE public.stock_batches CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_summary') THEN
        TRUNCATE TABLE public.stock_summary CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        TRUNCATE TABLE public.products CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        TRUNCATE TABLE public.product_categories CASCADE;
    END IF;
END $$;

-- Reset sequences to start from 1
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'stock_batches_batch_number_seq') THEN
        ALTER SEQUENCE stock_batches_batch_number_seq RESTART WITH 1;
    END IF;
END $$;

-- Ensure stock_summary table exists
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

-- Insert default stock summary record
INSERT INTO public.stock_summary (total_chickens, available_chickens, total_weight_kg, available_weight_kg, butchered_weight_kg, sold_weight_kg, waste_weight_kg)
VALUES (0, 0, 0.00, 0.00, 0.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- Create fresh sample data for testing
DO $$
DECLARE
    fresh_category_id UUID;
    processed_category_id UUID;
    organic_category_id UUID;
BEGIN
    -- 1. Product categories (only if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        INSERT INTO public.product_categories (name, description) VALUES 
        ('Fresh Chicken', 'Fresh chicken cuts and whole chickens'),
        ('Processed Meat', 'Marinated and processed chicken products'),
        ('Organic', 'Organic and free-range chicken products');
    END IF;
    
    -- 2. Sample products (only if both tables exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        
        -- Get category IDs
        SELECT id INTO fresh_category_id FROM public.product_categories WHERE name = 'Fresh Chicken' LIMIT 1;
        SELECT id INTO processed_category_id FROM public.product_categories WHERE name = 'Processed Meat' LIMIT 1;
        SELECT id INTO organic_category_id FROM public.product_categories WHERE name = 'Organic' LIMIT 1;
        
        -- Insert sample products with realistic prices (Pakistani Rupees)
        INSERT INTO public.products (name, description, price_per_kg, category_id) VALUES 
        ('Whole Chicken', 'Fresh whole chicken - farm raised', 280.00, fresh_category_id),
        ('Chicken Breast', 'Boneless chicken breast - premium cut', 520.00, fresh_category_id),
        ('Chicken Thigh', 'Fresh chicken thigh with bone', 380.00, fresh_category_id),
        ('Chicken Wings', 'Fresh chicken wings - perfect for BBQ', 320.00, fresh_category_id),
        ('Chicken Legs', 'Fresh chicken drumsticks', 300.00, fresh_category_id),
        ('Marinated Tikka', 'Chicken tikka pieces - ready to cook', 580.00, processed_category_id),
        ('Chicken Karahi Cut', 'Chicken pieces cut for karahi', 450.00, processed_category_id),
        ('Organic Whole Chicken', 'Free-range organic chicken', 420.00, organic_category_id),
        ('Organic Chicken Breast', 'Organic boneless chicken breast', 650.00, organic_category_id);
    END IF;
END $$;

-- Return a simple success message
SELECT 
    'Data cleanup completed successfully!' as message,
    COALESCE((SELECT COUNT(*) FROM public.user_profiles), 0) as users_preserved,
    COALESCE((SELECT COUNT(*) FROM public.product_categories), 0) as categories_created,
    COALESCE((SELECT COUNT(*) FROM public.products), 0) as products_created;