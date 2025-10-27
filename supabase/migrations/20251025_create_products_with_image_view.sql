-- Migration: create a view that exposes product image base64 and category name
BEGIN;

CREATE OR REPLACE VIEW public.products_with_image AS
SELECT
  p.*, 
  encode(p.image_data, 'base64') AS image_base64,
  -- image_mime is already included in p.*; don't select it twice
  pc.name AS category_name
FROM public.products p
LEFT JOIN public.product_categories pc ON p.category_id = pc.id;

GRANT SELECT ON public.products_with_image TO public;

COMMIT;
