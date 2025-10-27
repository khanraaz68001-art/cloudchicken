-- Fix waste management relationships
-- Drop and recreate enhanced_waste_records with proper foreign keys

-- Drop the existing table if it exists
DROP TABLE IF EXISTS public.enhanced_waste_records CASCADE;

-- Create enhanced waste records table with proper foreign key columns
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

-- Create indexes for better performance
CREATE INDEX idx_enhanced_waste_records_individual_chicken ON public.enhanced_waste_records(individual_chicken_id);
CREATE INDEX idx_enhanced_waste_records_butchered_meat ON public.enhanced_waste_records(butchered_meat_id);
CREATE INDEX idx_enhanced_waste_records_recorded_at ON public.enhanced_waste_records(recorded_at DESC);
CREATE INDEX idx_enhanced_waste_records_source_type ON public.enhanced_waste_records(source_type);

-- Drop existing record_waste function if it exists
DROP FUNCTION IF EXISTS public.record_waste(TEXT, UUID, DECIMAL, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.record_waste(TEXT, UUID, DECIMAL, TEXT, UUID, TEXT);

-- Create the record_waste function with correct parameter order
CREATE OR REPLACE FUNCTION public.record_waste(
    p_source_type TEXT,
    p_source_id UUID,
    p_waste_weight_kg DECIMAL,
    p_waste_reason TEXT,
    p_recorded_by UUID,
    p_waste_category TEXT DEFAULT 'other'
) RETURNS TABLE(success BOOLEAN, message TEXT, waste_id UUID)
AS $$
DECLARE
    source_weight DECIMAL;
    source_status TEXT;
    new_waste_id UUID;
BEGIN
    -- Validate source exists and get its details
    IF p_source_type = 'whole_chicken' THEN
        SELECT current_weight_kg, status INTO source_weight, source_status
        FROM public.individual_chickens 
        WHERE id = p_source_id;
        
        IF source_weight IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Chicken not found', NULL::UUID;
            RETURN;
        END IF;
        
        IF source_status != 'available' THEN
            RETURN QUERY SELECT FALSE, 'Chicken is not available for waste recording', NULL::UUID;
            RETURN;
        END IF;
        
        -- Check if waste weight is not more than chicken weight
        IF p_waste_weight_kg > source_weight THEN
            RETURN QUERY SELECT FALSE, 'Waste weight cannot exceed chicken weight', NULL::UUID;
            RETURN;
        END IF;
        
        -- If entire chicken is wasted, mark it as trashed
        IF p_waste_weight_kg = source_weight THEN
            UPDATE public.individual_chickens 
            SET status = 'trashed', updated_at = NOW()
            WHERE id = p_source_id;
        ELSE
            -- Reduce the weight of the chicken
            UPDATE public.individual_chickens 
            SET current_weight_kg = current_weight_kg - p_waste_weight_kg, updated_at = NOW()
            WHERE id = p_source_id;
        END IF;
        
    ELSIF p_source_type = 'butchered_meat' THEN
        SELECT weight_kg, status INTO source_weight, source_status
        FROM public.butchered_meat 
        WHERE id = p_source_id;
        
        IF source_weight IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Butchered meat not found', NULL::UUID;
            RETURN;
        END IF;
        
        IF source_status != 'available' THEN
            RETURN QUERY SELECT FALSE, 'Butchered meat is not available for waste recording', NULL::UUID;
            RETURN;
        END IF;
        
        -- Check if waste weight is not more than meat weight
        IF p_waste_weight_kg > source_weight THEN
            RETURN QUERY SELECT FALSE, 'Waste weight cannot exceed meat weight', NULL::UUID;
            RETURN;
        END IF;
        
        -- If entire meat is wasted, mark it as trashed
        IF p_waste_weight_kg = source_weight THEN
            UPDATE public.butchered_meat 
            SET status = 'trashed', updated_at = NOW()
            WHERE id = p_source_id;
        ELSE
            -- Reduce the weight of the butchered meat
            UPDATE public.butchered_meat 
            SET weight_kg = weight_kg - p_waste_weight_kg, updated_at = NOW()
            WHERE id = p_source_id;
        END IF;
    ELSE
        RETURN QUERY SELECT FALSE, 'Invalid source type', NULL::UUID;
        RETURN;
    END IF;
    
    -- Record the waste with proper foreign key values
    INSERT INTO public.enhanced_waste_records (
        source_type,
        source_id,
        individual_chicken_id,
        butchered_meat_id,
        waste_weight_kg,
        waste_reason,
        waste_category,
        recorded_by
    ) VALUES (
        p_source_type,
        p_source_id,
        CASE WHEN p_source_type = 'whole_chicken' THEN p_source_id ELSE NULL END,
        CASE WHEN p_source_type = 'butchered_meat' THEN p_source_id ELSE NULL END,
        p_waste_weight_kg,
        p_waste_reason,
        p_waste_category,
        p_recorded_by
    ) RETURNING id INTO new_waste_id;
    
    -- Update stock summary if function exists
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_stock_summary') THEN
        PERFORM update_stock_summary();
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Waste recorded successfully', new_waste_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing get_waste_summary function if it exists
DROP FUNCTION IF EXISTS public.get_waste_summary();

-- Create get_waste_summary function
CREATE OR REPLACE FUNCTION public.get_waste_summary()
RETURNS TABLE(
    total_waste_kg DECIMAL,
    chicken_waste_kg DECIMAL,
    butchered_waste_kg DECIMAL,
    waste_percentage DECIMAL,
    records_count BIGINT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(waste_weight_kg), 0) as total_waste_kg,
        COALESCE(SUM(CASE WHEN source_type = 'whole_chicken' THEN waste_weight_kg ELSE 0 END), 0) as chicken_waste_kg,
        COALESCE(SUM(CASE WHEN source_type = 'butchered_meat' THEN waste_weight_kg ELSE 0 END), 0) as butchered_waste_kg,
        CASE 
            WHEN (SELECT SUM(current_weight_kg) FROM individual_chickens) > 0 
            THEN (COALESCE(SUM(waste_weight_kg), 0) / (SELECT SUM(current_weight_kg) FROM individual_chickens)) * 100
            ELSE 0
        END as waste_percentage,
        COUNT(*) as records_count
    FROM public.enhanced_waste_records;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.enhanced_waste_records TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_waste TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waste_summary TO authenticated;

-- Enable RLS
ALTER TABLE public.enhanced_waste_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations for authenticated users" ON public.enhanced_waste_records
FOR ALL USING (auth.role() = 'authenticated');