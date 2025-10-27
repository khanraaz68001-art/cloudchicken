-- 🧹 SIMPLE DATA CLEANUP - Keep All Users, Clear All Data
-- Run this in Supabase SQL Editor to reset all operational data while preserving user accounts

-- Clear all operational data safely (only if tables exist)
DO $$
BEGIN
    -- Clear tables in dependency order, but only if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enhanced_waste_records') THEN
        TRUNCATE TABLE public.enhanced_waste_records CASCADE;
        RAISE NOTICE 'Cleared: enhanced_waste_records';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
        TRUNCATE TABLE public.order_items CASCADE;
        RAISE NOTICE 'Cleared: order_items';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        TRUNCATE TABLE public.orders CASCADE;
        RAISE NOTICE 'Cleared: orders';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'butchered_meat') THEN
        TRUNCATE TABLE public.butchered_meat CASCADE;
        RAISE NOTICE 'Cleared: butchered_meat';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'individual_chickens') THEN
        TRUNCATE TABLE public.individual_chickens CASCADE;
        RAISE NOTICE 'Cleared: individual_chickens';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_batches') THEN
        TRUNCATE TABLE public.stock_batches CASCADE;
        RAISE NOTICE 'Cleared: stock_batches';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_summary') THEN
        TRUNCATE TABLE public.stock_summary CASCADE;
        RAISE NOTICE 'Cleared: stock_summary';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        TRUNCATE TABLE public.products CASCADE;
        RAISE NOTICE 'Cleared: products';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        TRUNCATE TABLE public.product_categories CASCADE;
        RAISE NOTICE 'Cleared: product_categories';
    END IF;
END $$;

-- Reset sequences to start from 1
DO $$
BEGIN
    -- Reset stock batch numbering
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'stock_batches_batch_number_seq') THEN
        ALTER SEQUENCE stock_batches_batch_number_seq RESTART WITH 1;
    END IF;
END $$;

-- Create fresh sample data for testing (only if tables exist)
DO $$
BEGIN
    -- 1. Product categories (only if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        INSERT INTO public.product_categories (name, description) VALUES 
        ('Fresh Chicken', 'Fresh chicken cuts and whole chickens'),
        ('Processed Meat', 'Marinated and processed chicken products'),
        ('Organic', 'Organic and free-range chicken products');
        RAISE NOTICE 'Created sample product categories';
    ELSE
        RAISE NOTICE 'Skipping product_categories - table does not exist';
    END IF;
END $$;

-- 2. Sample products
DO $$
DECLARE
    fresh_category_id UUID;
    processed_category_id UUID;
    organic_category_id UUID;
BEGIN
    -- Only create products if both tables exist
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
        
        RAISE NOTICE 'Created sample products';
    ELSE
        RAISE NOTICE 'Skipping products - required tables do not exist';
    END IF;
END $$;

-- Display summary
DO $$
DECLARE
    user_count INTEGER := 0;
    category_count INTEGER := 0;
    product_count INTEGER := 0;
BEGIN
    -- Get counts only if tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        SELECT COUNT(*) INTO user_count FROM public.user_profiles;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        SELECT COUNT(*) INTO category_count FROM public.product_categories;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        SELECT COUNT(*) INTO product_count FROM public.products;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧹===============================================🧹';
    RAISE NOTICE '           DATA CLEANUP COMPLETED!';
    RAISE NOTICE '🧹===============================================🧹';
    RAISE NOTICE '';
    RAISE NOTICE '✅ ALL OPERATIONAL DATA CLEARED:';
    RAISE NOTICE '   • Stock batches: CLEARED';
    RAISE NOTICE '   • Individual chickens: CLEARED';
    RAISE NOTICE '   • Butchered meat: CLEARED';
    RAISE NOTICE '   • Orders & order items: CLEARED';
    RAISE NOTICE '   • Waste records: CLEARED';
    RAISE NOTICE '   • Stock summary: CLEARED';
    RAISE NOTICE '';
    RAISE NOTICE '👥 USER ACCOUNTS PRESERVED: % users', user_count;
    RAISE NOTICE '📦 SAMPLE DATA CREATED:';
    RAISE NOTICE '   • Product categories: %', category_count;
    RAISE NOTICE '   • Products: %', product_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 READY TO TEST COMPLETE WORKFLOW:';
    RAISE NOTICE '   1. Login with existing user accounts';
    RAISE NOTICE '   2. Admin: Add stock batches (20kg with 10 chickens)';
    RAISE NOTICE '   3. Kitchen: Butcher chickens into products';
    RAISE NOTICE '   4. Customer: Browse and order from menu';
    RAISE NOTICE '   5. Waste: Record waste from any source';
    RAISE NOTICE '   6. Delivery: Track and fulfill orders';
    RAISE NOTICE '';
    RAISE NOTICE '💡 TIP: All your user accounts are still intact!';
    RAISE NOTICE '🧹===============================================🧹';
    RAISE NOTICE '';
END $$;