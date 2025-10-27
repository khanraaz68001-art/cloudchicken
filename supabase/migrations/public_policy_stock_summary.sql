-- Allow public/anon access to stock_summary for read (SELECT)
-- Run this in Supabase SQL editor if you want the REST endpoint to be readable without an authenticated user

-- Drop any restrictive policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.stock_summary;
DROP POLICY IF EXISTS "Allow select for roles" ON public.stock_summary;

-- Create a policy that permits SELECT for anon and authenticated roles
CREATE POLICY "Allow select for anon+auth" ON public.stock_summary
FOR SELECT
USING (auth.role() = 'anon' OR auth.role() = 'authenticated');

-- Additionally, grant SELECT at SQL level (optional, policies control access)
GRANT SELECT ON public.stock_summary TO authenticated;
-- Note: The 'anon' role is not a standard DB role to GRANT; use RLS policy for anonymous access.

-- Verify: return a simple row count
SELECT COUNT(*) AS stock_summary_rows FROM public.stock_summary;