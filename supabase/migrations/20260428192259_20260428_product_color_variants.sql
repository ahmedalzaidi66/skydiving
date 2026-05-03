/*
  # Product Color Variants

  ## Summary
  Adds support for per-product color variants. Each variant has a name, hex value,
  optional image URL, and a default flag. Order items gain a selected_color column
  so the chosen color is preserved with every purchase.

  ## New Tables
  - `product_color_variants`
    - `id` (uuid, PK)
    - `product_id` (uuid, FK products)
    - `name` (text) — human-readable label, e.g. "Midnight Blue"
    - `hex` (text) — CSS hex value, e.g. "#1E3A5F"
    - `image_url` (text, nullable) — color-specific product image
    - `is_default` (boolean) — only one per product should be true
    - `sort_order` (int)
    - `created_at` (timestamptz)

  ## Modified Tables
  - `order_items`: adds `selected_color` (text, nullable)

  ## Security
  - RLS enabled on product_color_variants
  - Public read access (storefront needs it)
  - Admin/service_role write access
*/

CREATE TABLE IF NOT EXISTS product_color_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT '',
  hex         text NOT NULL DEFAULT '#000000',
  image_url   text,
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pcv_product_idx ON product_color_variants(product_id, sort_order);

ALTER TABLE product_color_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read color variants"
  ON product_color_variants FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can insert color variants"
  ON product_color_variants FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update color variants"
  ON product_color_variants FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete color variants"
  ON product_color_variants FOR DELETE
  TO service_role
  USING (true);

-- Add selected_color to order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'selected_color'
  ) THEN
    ALTER TABLE order_items ADD COLUMN selected_color text;
  END IF;
END $$;
