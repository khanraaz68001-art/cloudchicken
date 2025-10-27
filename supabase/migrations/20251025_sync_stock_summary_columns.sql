-- Migration: Ensure stock_summary contains both naming variants (total_chickens and total_chickens_count etc.)
-- Run this in Supabase SQL editor if you see "column ... does not exist" errors for stock_summary

BEGIN;

-- Add missing integer count columns if not present
ALTER TABLE public.stock_summary
  ADD COLUMN IF NOT EXISTS total_chickens_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_chickens_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS butchered_chickens_count INTEGER DEFAULT 0;

-- Add missing non-_count columns if not present (counts)
ALTER TABLE public.stock_summary
  ADD COLUMN IF NOT EXISTS total_chickens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_chickens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS butchered_chickens INTEGER DEFAULT 0;

-- Add missing weight columns (if any)
ALTER TABLE public.stock_summary
  ADD COLUMN IF NOT EXISTS total_weight_kg DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_weight_kg DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS butchered_weight_kg DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_weight_kg DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waste_weight_kg DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Sync values between columns so both naming variants contain the same data
-- Use a PL/pgSQL block so we can safely UPDATE existing rows or INSERT a new summary row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stock_summary) THEN
    UPDATE public.stock_summary SET
      total_chickens = COALESCE(total_chickens, total_chickens_count),
      total_chickens_count = COALESCE(total_chickens_count, total_chickens),
      available_chickens = COALESCE(available_chickens, available_chickens_count),
      available_chickens_count = COALESCE(available_chickens_count, available_chickens),
      butchered_chickens = COALESCE(butchered_chickens, butchered_chickens_count),
      butchered_chickens_count = COALESCE(butchered_chickens_count, butchered_chickens),
      total_weight_kg = COALESCE(total_weight_kg, 0),
      available_weight_kg = COALESCE(available_weight_kg, 0),
      butchered_weight_kg = COALESCE(butchered_weight_kg, 0),
      sold_weight_kg = COALESCE(sold_weight_kg, 0),
      waste_weight_kg = COALESCE(waste_weight_kg, 0),
      last_updated = COALESCE(last_updated, NOW())
    WHERE id = (SELECT id FROM public.stock_summary LIMIT 1);
  ELSE
    INSERT INTO public.stock_summary (
      total_chickens,
      total_chickens_count,
      available_chickens,
      available_chickens_count,
      butchered_chickens,
      butchered_chickens_count,
      total_weight_kg,
      available_weight_kg,
      butchered_weight_kg,
      sold_weight_kg,
      waste_weight_kg,
      last_updated
    )
    SELECT 
      COUNT(*)::INT,
      COUNT(*)::INT,
      COUNT(CASE WHEN status = 'available' THEN 1 END)::INT,
      COUNT(CASE WHEN status = 'available' THEN 1 END)::INT,
      COUNT(CASE WHEN status = 'butchered' THEN 1 END)::INT,
      COUNT(CASE WHEN status = 'butchered' THEN 1 END)::INT,
      COALESCE(SUM(initial_weight_kg), 0),
      COALESCE(SUM(CASE WHEN status = 'available' THEN current_weight_kg ELSE 0 END), 0),
      COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'available'), 0),
      COALESCE((SELECT SUM(weight_kg) FROM public.butchered_meat WHERE status = 'sold'), 0),
      COALESCE((SELECT SUM(waste_weight_kg) FROM public.enhanced_waste_records), 0),
      NOW()
    FROM public.individual_chickens;
  END IF;
END;
$$;

COMMIT;
