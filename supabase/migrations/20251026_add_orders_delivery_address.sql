-- Migration: ensure `delivery_address` (and related optional columns) exist on `orders`
-- Run this in Supabase SQL editor if your client reports missing columns in schema cache

BEGIN;

-- Add delivery_address if missing (used by frontend order flows)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Add special_instructions if missing (optional field used by checkout)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Add quantity if missing (some clients store quantity per order row)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

COMMIT;
