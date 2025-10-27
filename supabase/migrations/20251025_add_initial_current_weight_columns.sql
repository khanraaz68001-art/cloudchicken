-- Migration: add initial_weight_kg and current_weight_kg if missing
-- Run in Supabase SQL editor or via your migration tool

BEGIN;

-- Add columns if they don't exist
ALTER TABLE public.individual_chickens
  ADD COLUMN IF NOT EXISTS initial_weight_kg DECIMAL(5,2);

ALTER TABLE public.individual_chickens
  ADD COLUMN IF NOT EXISTS current_weight_kg DECIMAL(5,2);

-- If an older column named weight_kg exists, copy its values into the new columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'individual_chickens' AND column_name = 'weight_kg'
  ) THEN
    -- populate missing values from weight_kg
    UPDATE public.individual_chickens
    SET initial_weight_kg = COALESCE(initial_weight_kg, weight_kg),
        current_weight_kg = COALESCE(current_weight_kg, weight_kg)
    WHERE COALESCE(initial_weight_kg, current_weight_kg) IS NULL;
  END IF;

  -- If still null (no weight_kg column or null values), set defaults to 0 to avoid null-related errors
  UPDATE public.individual_chickens
  SET initial_weight_kg = COALESCE(initial_weight_kg, 0),
      current_weight_kg = COALESCE(current_weight_kg, 0)
  WHERE initial_weight_kg IS NULL OR current_weight_kg IS NULL;
END$$;

COMMIT;

-- After running this migration, re-run/refresh any functions that reference initial_weight_kg/current_weight_kg
-- (or replace them with COALESCE(initial_weight_kg, weight_kg) if you prefer a single-column model).
