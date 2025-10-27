-- 🔧 CREATE/FIX stock_summary TABLE
-- This will drop and recreate the table with correct structure

-- Drop the existing table if it exists (to fix structure issues)
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

-- Create or update the update_stock_summary function
CREATE OR REPLACE FUNCTION public.update_stock_summary()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Clear existing summary
    -- Avoid bare DELETE to satisfy SQL editors/policies; delete all rows explicitly
    DELETE FROM public.stock_summary WHERE id IS NOT NULL;
    
    -- Insert new summary data (only if individual_chickens table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'individual_chickens') THEN
        INSERT INTO public.stock_summary (
            total_chickens,
            available_chickens,
            total_weight_kg,
            available_weight_kg,
            butchered_weight_kg,
            sold_weight_kg,
            waste_weight_kg
        )
        SELECT 
            COUNT(*),
            COUNT(CASE WHEN status = 'available' THEN 1 END),
            SUM(initial_weight_kg),
            SUM(CASE WHEN status = 'available' THEN current_weight_kg ELSE 0 END),
            COALESCE((SELECT SUM(weight_kg) FROM butchered_meat WHERE status = 'available'), 0),
            COALESCE((SELECT SUM(weight_kg) FROM butchered_meat WHERE status = 'sold'), 0),
            COALESCE((SELECT SUM(waste_weight_kg) FROM enhanced_waste_records), 0)
        FROM public.individual_chickens;
    ELSE
        -- Insert default row if no chickens table
        INSERT INTO public.stock_summary DEFAULT VALUES;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Return success message
SELECT 
    'stock_summary table created successfully!' as message,
    COUNT(*) as records_created
FROM public.stock_summary;