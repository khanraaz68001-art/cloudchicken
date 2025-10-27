-- Migration: Allow dev writes to stock_summary via RLS policy
-- Run this in Supabase SQL editor to add permissive development RLS policies for stock_summary.

BEGIN;

-- Enable RLS on stock_summary (if not already)
ALTER TABLE public.stock_summary ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies we might have created earlier
DROP POLICY IF EXISTS "Allow inserts on stock_summary (auth or anon)" ON public.stock_summary;
DROP POLICY IF EXISTS "Allow selects on stock_summary" ON public.stock_summary;
DROP POLICY IF EXISTS "Allow updates on stock_summary (auth or anon)" ON public.stock_summary;
DROP POLICY IF EXISTS "Allow deletes on stock_summary (auth or anon)" ON public.stock_summary;

-- INSERT: allow authenticated or anon (development convenience)
CREATE POLICY "Allow inserts on stock_summary (auth or anon)" ON public.stock_summary
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- SELECT: allow read to everyone (so the frontend can fetch the summary)
CREATE POLICY "Allow selects on stock_summary" ON public.stock_summary
  FOR SELECT
  USING (true);

-- UPDATE: allow authenticated or anon to update (development convenience)
CREATE POLICY "Allow updates on stock_summary (auth or anon)" ON public.stock_summary
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- DELETE: allow authenticated or anon (if needed during maintenance)
CREATE POLICY "Allow deletes on stock_summary (auth or anon)" ON public.stock_summary
  FOR DELETE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

COMMIT;
