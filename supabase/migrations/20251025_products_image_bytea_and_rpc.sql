-- Migration: store product images in DB (bytea) and provide RPC to upload base64 image
BEGIN;

-- Add image_data and image_mime columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_data BYTEA,
  ADD COLUMN IF NOT EXISTS image_mime TEXT;

-- Create RPC to upload product image from base64
CREATE OR REPLACE FUNCTION public.upload_product_image(
  p_product_id UUID,
  p_image_base64 TEXT,
  p_image_mime TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products
  SET image_data = decode(p_image_base64, 'base64'),
      image_mime = p_image_mime,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- Allow public to execute the RPC (development convenience). Tighten in production.
GRANT EXECUTE ON FUNCTION public.upload_product_image(UUID, TEXT, TEXT) TO public;

COMMIT;
