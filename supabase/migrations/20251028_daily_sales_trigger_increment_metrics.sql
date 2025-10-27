-- Migration: add trigger to increment metrics when daily_sales row is inserted

-- Trigger function: on insert into daily_sales, increment 'happy_customers' metric
CREATE OR REPLACE FUNCTION public.handle_daily_sales_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Use the RPC-style function increment_metric if available; otherwise update table directly
  BEGIN
    PERFORM public.increment_metric('happy_customers');
  EXCEPTION WHEN undefined_function THEN
    -- Fallback: ensure the metrics row exists then increment
    INSERT INTO public.metrics (key, value)
      VALUES ('happy_customers', 1)
      ON CONFLICT (key) DO UPDATE SET value = public.metrics.value + 1, updated_at = now();
  END;
  RETURN NEW;
END;
$$;

-- Create trigger (after insert)
DROP TRIGGER IF EXISTS trg_daily_sales_increment_metrics ON public.daily_sales;
CREATE TRIGGER trg_daily_sales_increment_metrics
AFTER INSERT ON public.daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_daily_sales_insert();
