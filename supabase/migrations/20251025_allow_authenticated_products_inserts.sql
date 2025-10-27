-- Migration: Allow authenticated users to insert/update/select products
-- Run this in Supabase SQL editor to add RLS policies that permit authenticated clients to write product rows.

BEGIN;

-- Ensure a permissive but safe policy for authenticated users on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow authenticated inserts on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated selects on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated updates on products" ON public.products;

-- Allow authenticated users to INSERT and CHECK (so inserts can succeed)
-- For INSERT policies PostgreSQL only allows a WITH CHECK expression; remove USING clause
-- Allow INSERTs from authenticated AND anon (development convenience). Tighten in production.
CREATE POLICY "Allow authenticated_including_anon_inserts_on_products" ON public.products
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Allow authenticated users to SELECT product rows (reader)
CREATE POLICY "Allow authenticated selects on products" ON public.products
  FOR SELECT
  USING (true);

-- Allow authenticated users to UPDATE rows they created (if you have an owner column)
-- For now let authenticated update as well (adjust later if you add an owner field)
CREATE POLICY "Allow authenticated_or_anon_updates_on_products" ON public.products
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

COMMIT;
