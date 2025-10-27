-- Migration: ensure `weight_kg` and `total_amount` exist on `orders`
-- Run this in Supabase SQL editor if your client reports missing columns in schema cache

BEGIN;

-- Add weight_kg if missing (used by frontend order flows)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2) DEFAULT 0;

-- Add total_amount if missing (used by frontend order flows)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;

COMMIT;
