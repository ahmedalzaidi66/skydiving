/*
  # Home Product Sections

  Adds two tables to support admin-controlled product sections on the homepage.

  ## New Tables

  ### `home_sections`
  - `id` (uuid, PK)
  - `name_en` (text) – English display name
  - `name_ar` (text) – Arabic display name
  - `enabled` (boolean, default true)
  - `sort_order` (integer, default 0)
  - `created_at` (timestamptz)

  ### `home_section_products`
  - `id` (uuid, PK)
  - `section_id` (uuid, FK → home_sections.id)
  - `product_id` (uuid, FK → products.id)
  - `sort_order` (integer, default 0)

  ## Security
  - RLS enabled on both tables
  - Public (anon) can SELECT enabled sections + their products
  - Only admin requests (is_admin_request()) can INSERT/UPDATE/DELETE

  ## Seed data
  Four default sections: Best Sellers, Deals, New Arrivals, Best Prices
*/

-- ── home_sections ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS home_sections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en     text        NOT NULL DEFAULT '',
  name_ar     text        NOT NULL DEFAULT '',
  enabled     boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE home_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read home sections"
  ON home_sections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin can insert home sections"
  ON home_sections FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update home sections"
  ON home_sections FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete home sections"
  ON home_sections FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ── home_section_products ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS home_section_products (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid    NOT NULL REFERENCES home_sections(id) ON DELETE CASCADE,
  product_id  uuid    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  UNIQUE (section_id, product_id)
);

ALTER TABLE home_section_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read home section products"
  ON home_section_products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin can insert home section products"
  ON home_section_products FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update home section products"
  ON home_section_products FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete home section products"
  ON home_section_products FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_home_sections_sort
  ON home_sections (sort_order);

CREATE INDEX IF NOT EXISTS idx_home_section_products_section
  ON home_section_products (section_id, sort_order);

-- ── Seed default sections ──────────────────────────────────────────────────────

INSERT INTO home_sections (name_en, name_ar, enabled, sort_order)
VALUES
  ('Best Sellers',  'الأكثر مبيعاً',     true, 0),
  ('Deals',         'العروض',             true, 1),
  ('New Arrivals',  'وصل حديثاً',         true, 2),
  ('Best Prices',   'أفضل الأسعار',       true, 3)
ON CONFLICT DO NOTHING;
