-- Migration: Create product pricing tiers for bulk pricing
-- This allows setting different rates for different quantity ranges of products

BEGIN;

-- Create product_pricing_tiers table for specific weight-based pricing
CREATE TABLE public.product_pricing_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  weight_kg DECIMAL(8,3) NOT NULL, -- Specific weight (e.g., 0.25, 0.5, 0.75, 1.0, etc.)
  price_total DECIMAL(10,2) NOT NULL, -- Total price for this specific weight
  price_per_kg DECIMAL(10,2) NOT NULL, -- Calculated price per kg for this weight
  tier_name TEXT, -- Optional display name (e.g., "250g", "500g", "1kg")
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0, -- Display order
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid weight and unique weight per product
  CONSTRAINT valid_weight CHECK (weight_kg > 0 AND weight_kg <= 5.0), -- Max 5kg as requested
  CONSTRAINT unique_product_weight UNIQUE (product_id, weight_kg)
);

-- Add indexes for performance
CREATE INDEX idx_product_pricing_tiers_product_id ON public.product_pricing_tiers(product_id);
CREATE INDEX idx_product_pricing_tiers_weight ON public.product_pricing_tiers(product_id, weight_kg);

-- Enable RLS
ALTER TABLE public.product_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all authenticated on product_pricing_tiers" 
ON public.product_pricing_tiers FOR ALL 
USING (auth.role() IN ('authenticated', 'anon'));

-- Grant permissions
GRANT ALL ON public.product_pricing_tiers TO authenticated;
GRANT SELECT ON public.product_pricing_tiers TO anon;

-- Create a function to get the correct price for a given product and specific weight
CREATE OR REPLACE FUNCTION public.get_product_price_for_weight(p_product_id UUID, p_weight_kg DECIMAL)
RETURNS TABLE(total_price DECIMAL(10,2), price_per_kg DECIMAL(10,2))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_total DECIMAL(10,2);
  tier_per_kg DECIMAL(10,2);
  base_price DECIMAL(10,2);
BEGIN
  -- Try to find exact weight match first
  SELECT price_total, price_per_kg INTO tier_total, tier_per_kg
  FROM public.product_pricing_tiers
  WHERE product_id = p_product_id
    AND is_active = TRUE
    AND weight_kg = p_weight_kg
  LIMIT 1;
  
  IF tier_total IS NOT NULL THEN
    RETURN QUERY SELECT tier_total, tier_per_kg;
    RETURN;
  END IF;
  
  -- If no exact match, use base price calculation
  SELECT base_price_per_kg INTO base_price 
  FROM public.products 
  WHERE id = p_product_id;
  
  RETURN QUERY SELECT 
    (base_price * p_weight_kg)::DECIMAL(10,2) as total_price,
    base_price as price_per_kg;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_product_price_for_weight(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_price_for_weight(UUID, DECIMAL) TO anon;

-- Create a view that shows products with their weight-specific pricing tiers
CREATE OR REPLACE VIEW public.products_with_pricing_tiers AS
SELECT 
  p.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', pt.id,
        'weight_kg', pt.weight_kg,
        'price_total', pt.price_total,
        'price_per_kg', pt.price_per_kg,
        'tier_name', pt.tier_name,
        'is_active', pt.is_active,
        'sort_order', pt.sort_order
      ) ORDER BY pt.sort_order, pt.weight_kg
    ) FILTER (WHERE pt.id IS NOT NULL),
    '[]'::json
  ) AS pricing_tiers,
  encode(p.image_data, 'base64') AS image_base64,
  pc.name AS category_name
FROM public.products p
LEFT JOIN public.product_categories pc ON p.category_id = pc.id
LEFT JOIN public.product_pricing_tiers pt ON p.id = pt.product_id AND pt.is_active = TRUE
GROUP BY p.id, pc.name;

-- Grant permissions on the view
GRANT SELECT ON public.products_with_pricing_tiers TO authenticated;
GRANT SELECT ON public.products_with_pricing_tiers TO anon;

-- Insert some example weight-based pricing tiers for testing (optional - remove in production)
-- Uncomment the following lines if you want to add sample data:

/*
-- Example: Add weight-specific pricing for an existing product
-- Replace 'your-product-id' with an actual product ID from your products table

INSERT INTO public.product_pricing_tiers (product_id, weight_kg, price_total, price_per_kg, tier_name, sort_order) VALUES
-- Common weight options with potentially better per-kg rates for larger quantities
-- ('your-product-id', 0.25, 120.00, 480.00, '250g', 1),
-- ('your-product-id', 0.5, 225.00, 450.00, '500g', 2),
-- ('your-product-id', 0.75, 320.00, 426.67, '750g', 3),
-- ('your-product-id', 1.0, 400.00, 400.00, '1kg', 4),
-- ('your-product-id', 1.5, 570.00, 380.00, '1.5kg', 5),
-- ('your-product-id', 2.0, 720.00, 360.00, '2kg', 6),
-- ('your-product-id', 3.0, 1020.00, 340.00, '3kg', 7),
-- ('your-product-id', 5.0, 1650.00, 330.00, '5kg', 8);
*/

COMMIT;