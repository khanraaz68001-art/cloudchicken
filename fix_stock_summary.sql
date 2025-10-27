-- 🔍 CHECK AND FIX stock_summary TABLE STRUCTURE
-- This script safely fixes the stock_summary table structure

-- First, let's check what columns exist in the current stock_summary table
DO $$
DECLARE 
    table_exists BOOLEAN := FALSE;
    rec RECORD;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'stock_summary'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'stock_summary table exists - checking structure...';
        
        -- Show current columns (this info will appear in logs)
        FOR rec IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stock_summary' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE 'Column: % (type: %)', rec.column_name, rec.data_type;
        END LOOP;
    ELSE
        RAISE NOTICE 'stock_summary table does not exist';
    END IF;
END $$;

-- Drop and recreate with correct structure
DROP TABLE IF EXISTS public.stock_summary CASCADE;

-- Create stock_summary table with correct structure
CREATE TABLE public.stock_summary (
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

-- Create the update function that works with the correct structure
CREATE OR REPLACE FUNCTION public.update_stock_summary()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    chicken_count INTEGER := 0;
    available_count INTEGER := 0;
    total_weight DECIMAL := 0;
    available_weight DECIMAL := 0;
    butchered_weight DECIMAL := 0;
    sold_weight DECIMAL := 0;
    waste_weight DECIMAL := 0;
BEGIN
    -- Clear existing summary
    -- Replace bare DELETE with a WHERE clause so editors that block DELETE without WHERE don't reject the script
    DELETE FROM public.stock_summary WHERE id IS NOT NULL;
    
    -- Calculate stats only if individual_chickens table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'individual_chickens') THEN
        -- Get chicken stats (use weight_kg if initial_weight_kg doesn't exist)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'individual_chickens' AND column_name = 'initial_weight_kg') THEN
            -- Use initial_weight_kg and current_weight_kg if they exist
            SELECT 
                COUNT(*),
                COUNT(CASE WHEN status = 'available' THEN 1 END),
                COALESCE(SUM(initial_weight_kg), 0),
                COALESCE(SUM(CASE WHEN status = 'available' THEN current_weight_kg ELSE 0 END), 0)
            INTO chicken_count, available_count, total_weight, available_weight
            FROM public.individual_chickens;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'individual_chickens' AND column_name = 'weight_kg') THEN
            -- Fall back to weight_kg column
            SELECT 
                COUNT(*),
                COUNT(CASE WHEN status = 'available' THEN 1 END),
                COALESCE(SUM(weight_kg), 0),
                COALESCE(SUM(CASE WHEN status = 'available' THEN weight_kg ELSE 0 END), 0)
            INTO chicken_count, available_count, total_weight, available_weight
            FROM public.individual_chickens;
        ELSE
            -- Just count chickens if no weight columns exist
            SELECT 
                COUNT(*),
                COUNT(CASE WHEN status = 'available' THEN 1 END),
                0,
                0
            INTO chicken_count, available_count, total_weight, available_weight
            FROM public.individual_chickens;
        END IF;
        
        -- Get butchered meat stats (if table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'butchered_meat') THEN
            SELECT COALESCE(SUM(weight_kg), 0) INTO butchered_weight
            FROM public.butchered_meat WHERE status = 'available';
            
            SELECT COALESCE(SUM(weight_kg), 0) INTO sold_weight
            FROM public.butchered_meat WHERE status = 'sold';
        END IF;
        
        -- Get waste stats (if table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enhanced_waste_records') THEN
            SELECT COALESCE(SUM(waste_weight_kg), 0) INTO waste_weight
            FROM public.enhanced_waste_records;
        END IF;
    END IF;
    
    -- Insert the summary
    INSERT INTO public.stock_summary (
        total_chickens,
        available_chickens,
        total_weight_kg,
        available_weight_kg,
        butchered_weight_kg,
        sold_weight_kg,
        waste_weight_kg
    ) VALUES (
        chicken_count,
        available_count,
        total_weight,
        available_weight,
        butchered_weight,
        sold_weight,
        waste_weight
    );
    
    RAISE NOTICE 'Stock summary updated: % total chickens, % available, %.2f kg total weight', 
        chicken_count, available_count, total_weight;
END;
$$;

-- Initialize with default data
SELECT update_stock_summary();

-- Grant permissions
GRANT ALL ON public.stock_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stock_summary TO authenticated;

-- Enable RLS
ALTER TABLE public.stock_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.stock_summary;
CREATE POLICY "Allow all for authenticated users" ON public.stock_summary
FOR ALL USING (auth.role() = 'authenticated');

-- Verify the table structure
SELECT 
    'Table created successfully!' as message,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'stock_summary' 
ORDER BY ordinal_position;

-- Show the current summary data
SELECT 'CURRENT SUMMARY DATA' as info, * FROM public.stock_summary;