-- Migration: Enable CRUD RLS policies for products and product_categories
-- Run this in Supabase SQL editor to allow authenticated clients to perform CRUD on these tables during development.

BEGIN;

-- PRODUCTS: enable RLS and create CRUD policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated inserts on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated selects on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated updates on products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated deletes on products" ON public.products;

-- INSERT: allow authenticated users (WITH CHECK only)
CREATE POLICY "Allow inserts on products (auth or anon)" ON public.products
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- SELECT: allow read to everyone (keep product catalog public)
CREATE POLICY "Allow authenticated selects on products" ON public.products
  FOR SELECT
  USING (true);

-- UPDATE: allow authenticated users to update (tighten later to owner-based)
CREATE POLICY "Allow updates on products (auth or anon)" ON public.products
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- DELETE: allow authenticated users to delete (tighten later to owner-based)
CREATE POLICY "Allow deletes on products (auth or anon)" ON public.products
  FOR DELETE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- PRODUCT CATEGORIES: enable RLS and create CRUD policies
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated inserts on product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Allow authenticated selects on product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Allow authenticated updates on product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Allow authenticated deletes on product_categories" ON public.product_categories;

CREATE POLICY "Allow inserts on product_categories (auth or anon)" ON public.product_categories
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow authenticated selects on product_categories" ON public.product_categories
  FOR SELECT
  USING (true);

CREATE POLICY "Allow updates on product_categories (auth or anon)" ON public.product_categories
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow deletes on product_categories (auth or anon)" ON public.product_categories
  FOR DELETE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

COMMIT;
