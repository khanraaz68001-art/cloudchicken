-- Migration: create a force-order RPC to insert orders regardless of stock checks
-- Run this in Supabase SQL editor if your DB blocks order inserts due to stock constraints

BEGIN;

-- Create a SECURITY DEFINER function that will insert an order ignoring any application-level
-- or trigger-based stock validation. Use with caution: this bypasses stock checks.
CREATE OR REPLACE FUNCTION public.create_order_force(
  p_user_id UUID,
  p_product_id UUID,
  p_weight_kg DECIMAL,
  p_total_amount DECIMAL,
  p_delivery_address TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, order_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_order_id UUID;
BEGIN
  INSERT INTO public.orders (id, user_id, product_id, weight_kg, total_amount, delivery_address, status, created_at, updated_at)
  VALUES (gen_random_uuid(), p_user_id, p_product_id, p_weight_kg, p_total_amount, p_delivery_address, 'pending', NOW(), NOW())
  RETURNING id INTO new_order_id;

  RETURN QUERY SELECT TRUE, 'Order created (force)', new_order_id;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM, NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_force(UUID, UUID, DECIMAL, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_force(UUID, UUID, DECIMAL, DECIMAL, TEXT) TO public;

COMMIT;
