-- Enhanced Waste Management Schema
-- Run this after enhanced-stock-schema.sql

-- 1. Create enhanced waste records table
DROP TABLE IF EXISTS public.enhanced_waste_records CASCADE;
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

-- 2. Create function to record waste
CREATE OR REPLACE FUNCTION record_waste(
    p_source_type TEXT,
    p_source_id UUID,
    p_waste_weight_kg DECIMAL,
    p_waste_reason TEXT,
    p_waste_category TEXT,
    p_recorded_by UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    waste_record_id UUID
) AS $$
DECLARE
    new_waste_id UUID;
    source_weight DECIMAL;
    source_status TEXT;
BEGIN
    -- Validate source exists and get its details
    IF p_source_type = 'whole_chicken' THEN
        SELECT weight_kg, status INTO source_weight, source_status
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
    
    -- Record the waste
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
        CASE WHEN p_source_type = 'whole_chicken' THEN p_source_id::UUID ELSE NULL END,
        CASE WHEN p_source_type = 'butchered_meat' THEN p_source_id::UUID ELSE NULL END,
        p_waste_weight_kg,
        p_waste_reason,
        p_waste_category,
        p_recorded_by
    ) RETURNING id INTO new_waste_id;
    
    -- Update stock summary
    PERFORM update_stock_summary();
    
    RETURN QUERY SELECT TRUE, 'Waste recorded successfully', new_waste_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to get waste summary
CREATE OR REPLACE FUNCTION get_waste_summary()
RETURNS TABLE(
    total_waste_kg DECIMAL,
    chicken_waste_kg DECIMAL,
    butchered_waste_kg DECIMAL,
    waste_percentage DECIMAL,
    records_count INTEGER
) AS $$
DECLARE
    total_inventory_kg DECIMAL;
BEGIN
    -- Get total waste
    SELECT 
        COALESCE(SUM(waste_weight_kg), 0),
        COALESCE(SUM(CASE WHEN source_type = 'whole_chicken' THEN waste_weight_kg ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source_type = 'butchered_meat' THEN waste_weight_kg ELSE 0 END), 0),
        COUNT(*)
    INTO total_waste_kg, chicken_waste_kg, butchered_waste_kg, records_count
    FROM public.enhanced_waste_records;
    
    -- Get total inventory (available + butchered + wasted)
    SELECT 
        (SELECT COALESCE(SUM(weight_kg), 0) FROM public.individual_chickens) +
        (SELECT COALESCE(SUM(weight_kg), 0) FROM public.butchered_meat) +
        total_waste_kg
    INTO total_inventory_kg;
    
    -- Calculate waste percentage
    IF total_inventory_kg > 0 THEN
        waste_percentage := (total_waste_kg / total_inventory_kg) * 100;
    ELSE
        waste_percentage := 0;
    END IF;
    
    RETURN QUERY SELECT total_waste_kg, chicken_waste_kg, butchered_waste_kg, waste_percentage, records_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Update stock summary to include waste tracking
DROP FUNCTION IF EXISTS update_stock_summary();
CREATE OR REPLACE FUNCTION update_stock_summary()
RETURNS VOID AS $$
DECLARE
    waste_summary_data RECORD;
BEGIN
    -- Get waste summary
    SELECT * INTO waste_summary_data FROM get_waste_summary();
    
    -- Update stock summary with waste information
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
$$ LANGUAGE plpgsql;

-- 5. Create trigger to update stock when waste is recorded
CREATE OR REPLACE FUNCTION trigger_update_stock_on_waste()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_stock_summary();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enhanced_waste_stock_update
    AFTER INSERT OR UPDATE OR DELETE ON public.enhanced_waste_records
    FOR EACH ROW EXECUTE FUNCTION trigger_update_stock_on_waste();

-- 6. Create views for easier querying
CREATE OR REPLACE VIEW waste_records_with_details AS
SELECT 
    ewr.*,
    up.name as recorded_by_name,
    CASE 
        WHEN ewr.source_type = 'whole_chicken' THEN 
            ic.batch_number || ' (' || ic.weight_kg || 'kg chicken)'
        WHEN ewr.source_type = 'butchered_meat' THEN
            p.name || ' (' || bm.weight_kg || 'kg)'
        ELSE 'Unknown'
    END as source_description
FROM public.enhanced_waste_records ewr
LEFT JOIN public.user_profiles up ON ewr.recorded_by = up.id
LEFT JOIN public.individual_chickens ic ON (ewr.source_type = 'whole_chicken' AND ewr.source_id = ic.id)
LEFT JOIN public.butchered_meat bm ON (ewr.source_type = 'butchered_meat' AND ewr.source_id = bm.id)
LEFT JOIN public.products p ON bm.product_id = p.id;

-- 7. Disable RLS for waste tables
ALTER TABLE public.enhanced_waste_records DISABLE ROW LEVEL SECURITY;

-- 8. Insert some sample waste data for testing
-- (You can remove this section in production)
DO $$
DECLARE
    sample_chicken_id UUID;
    sample_admin_id UUID;
BEGIN
    -- Get a sample chicken and admin user for testing
    SELECT id INTO sample_chicken_id FROM public.individual_chickens WHERE status = 'available' LIMIT 1;
    SELECT id INTO sample_admin_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;
    
    -- Only insert if we have the required data
    IF sample_chicken_id IS NOT NULL AND sample_admin_id IS NOT NULL THEN
        -- Record some sample waste for demonstration
        INSERT INTO public.enhanced_waste_records (
            source_type,
            source_id,
            waste_weight_kg,
            waste_reason,
            waste_category,
            recorded_by
        ) VALUES 
        (
            'whole_chicken',
            sample_chicken_id,
            0.2,
            'Small bruise found during inspection',
            'damage',
            sample_admin_id
        );
        
        RAISE NOTICE 'Sample waste record created for testing';
    END IF;
END $$;

-- Enhanced waste management system is now ready!
-- Features:
-- 1. Track waste from both whole chickens and butchered meat
-- 2. Automatic inventory updates when waste is recorded
-- 3. Comprehensive waste analytics and reporting
-- 4. Different waste categories for better tracking
-- 5. Integration with existing stock management system