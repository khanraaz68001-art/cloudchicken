-- Migration: create metrics table and increment function

CREATE TABLE IF NOT EXISTS public.metrics (
  key text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Seed default happy_customers if not exists
INSERT INTO public.metrics (key, value)
SELECT 'happy_customers', 5
WHERE NOT EXISTS (SELECT 1 FROM public.metrics WHERE key = 'happy_customers');

-- Atomic increment function available as RPC 'increment_metric(metric_key text)'
CREATE OR REPLACE FUNCTION public.increment_metric(metric_key text)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO public.metrics (key, value)
  VALUES (metric_key, 1)
  ON CONFLICT (key) DO UPDATE SET value = public.metrics.value + 1, updated_at = now()
  RETURNING value;
$$;

-- Read helper (optional) as RPC 'get_metric(metric_key text)'
CREATE OR REPLACE FUNCTION public.get_metric(metric_key text)
RETURNS bigint LANGUAGE sql AS $$
  SELECT value FROM public.metrics WHERE key = metric_key LIMIT 1;
$$;
