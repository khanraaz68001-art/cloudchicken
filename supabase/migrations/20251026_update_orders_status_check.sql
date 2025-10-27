-- Migration: unify / expand allowed order statuses
-- Purpose: ensure the orders.status CHECK accepts the union of statuses used by the app
-- Run this in your Supabase SQL editor (or via pg CLI) to update the constraint and default.

BEGIN;

-- Remove the old constraint if present
ALTER TABLE IF EXISTS public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

-- Set a safe default used by the app
ALTER TABLE IF EXISTS public.orders
  ALTER COLUMN status SET DEFAULT 'pending';

-- Recreate the constraint with a union of statuses observed in the project
ALTER TABLE IF EXISTS public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending',
      'placed',
      'accepted',
      'confirmed',
      'cutting',
      'preparing',
      'packing',
      'ready',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  );

COMMIT;

-- Notes:
--  - This migration intentionally allows both 'placed' and 'pending' so existing DBs and frontend code variations won't fail.
--  - After running, re-test placing an order. If you prefer a narrower canonical set, edit the list above and re-run.
