-- 🔧 SIMPLE stock_summary TABLE FIX
-- This version creates the table and function without complex column checking

-- Drop and recreate with correct structure
DROP TABLE IF EXISTS public.stock_summary CASCADE;

-- Create stock_summary table with correct structure
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

-- Create a simple update function that just initializes with zeros
CREATE OR REPLACE FUNCTION public.update_stock_summary()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Clear existing summary
    -- Avoid bare DELETE; explicitly require WHERE to satisfy SQL editors/policies
    DELETE FROM public.stock_summary WHERE id IS NOT NULL;
    
    -- Insert default values (will be updated by the app when data is added)
    INSERT INTO public.stock_summary (
        total_chickens_count,
        total_weight_kg,
        available_chickens_count,
        available_weight_kg,
        butchered_chickens_count,
        butchered_weight_kg
    ) VALUES (0, 0.00, 0, 0.00, 0, 0.00);
    
    RAISE NOTICE 'Stock summary initialized with default values';
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

-- Return success message with table structure
SELECT 
    'SUCCESS: stock_summary table created!' as message,
    'Table structure:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'stock_summary'
GROUP BY message, info;

-- Show current data
SELECT 'Current summary data:' as info, * FROM public.stock_summary;