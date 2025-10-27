-- Migration: ensure orders.product_id exists and add FK to products(id)
-- Run in Supabase SQL editor to create the relationship PostgREST needs for nested selects

BEGIN;

-- add product_id column if missing
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_id UUID;

-- add quantity column if missing (fallback)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add foreign key constraint if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'orders'
      AND tc.constraint_name = 'fk_orders_product_id'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT fk_orders_product_id FOREIGN KEY (product_id)
        REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END;
$$;

COMMIT;
