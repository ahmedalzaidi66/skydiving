/*
  # Create product_images table

  ## Summary
  Adds a dedicated product_images table to store per-product gallery images with
  ordering and primary-image designation. Replaces the ad-hoc use of the products.images
  JSONB column for gallery management.

  ## New Tables
  - `product_images`
    - `id` (uuid, primary key)
    - `product_id` (uuid, FK → products.id, CASCADE delete)
    - `url` (text, not null) — public URL of the uploaded image
    - `is_main` (boolean, default false) — true for the primary/cover image
    - `sort_order` (integer, default 0) — display order, lower = earlier
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public SELECT (storefront reads gallery)
  - Admin INSERT/UPDATE/DELETE via is_admin_request()

  ## Notes
  - sort_order determines gallery display order on storefront and admin
  - Only one row per product should have is_main = true (enforced by app logic)
  - On product delete, all gallery rows cascade-delete automatically
*/

CREATE TABLE IF NOT EXISTS product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  is_main     boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON product_images(product_id);
CREATE INDEX IF NOT EXISTS product_images_sort_order_idx  ON product_images(product_id, sort_order);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Public storefront can read gallery images
CREATE POLICY "Public can view product images"
  ON product_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin INSERT
CREATE POLICY "Admin can insert product images"
  ON product_images FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

-- Admin UPDATE (reorder, set main, replace url)
CREATE POLICY "Admin can update product images"
  ON product_images FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- Admin DELETE
CREATE POLICY "Admin can delete product images"
  ON product_images FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());
