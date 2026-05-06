/*
  # Create home_sections and home_section_products tables

  These tables back the admin "Home Sections" page (app/admin/sections.tsx)
  and the homepage product-section carousel (app/(tabs)/index.tsx).

  Note: these are distinct from the older `homepage_sections` /
  `homepage_section_products` tables which have a different schema and are
  not referenced by the current codebase.

  1. New Tables
    - `home_sections`
        - id          (uuid, pk)
        - name_en     (text, not null) — English display name
        - name_ar     (text)           — Arabic display name
        - enabled     (bool)           — whether section appears on homepage
        - sort_order  (int)            — display order, ascending
        - created_at  (timestamptz)

    - `home_section_products`
        - id          (uuid, pk)
        - section_id  (uuid, fk → home_sections.id, cascade delete)
        - product_id  (uuid, fk → products.id, cascade delete)
        - sort_order  (int)
        - created_at  (timestamptz)
        - UNIQUE (section_id, product_id) — no duplicates per section

  2. Security
    - RLS enabled on both tables
    - Public (anon + authenticated) can SELECT enabled sections and their products
    - Authenticated users (admin client) can INSERT / UPDATE / DELETE
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_sections' AND policyname = 'Public can read home sections'
  ) THEN
    CREATE POLICY "Public can read home sections"
      ON home_sections FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_sections' AND policyname = 'Authenticated can insert home sections'
  ) THEN
    CREATE POLICY "Authenticated can insert home sections"
      ON home_sections FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_sections' AND policyname = 'Authenticated can update home sections'
  ) THEN
    CREATE POLICY "Authenticated can update home sections"
      ON home_sections FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_sections' AND policyname = 'Authenticated can delete home sections'
  ) THEN
    CREATE POLICY "Authenticated can delete home sections"
      ON home_sections FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ── home_section_products ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS home_section_products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid        NOT NULL REFERENCES home_sections(id) ON DELETE CASCADE,
  product_id  uuid        NOT NULL REFERENCES products(id)       ON DELETE CASCADE,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_home_section_products_section
  ON home_section_products (section_id);

ALTER TABLE home_section_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_section_products' AND policyname = 'Public can read home section products'
  ) THEN
    CREATE POLICY "Public can read home section products"
      ON home_section_products FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_section_products' AND policyname = 'Authenticated can insert home section products'
  ) THEN
    CREATE POLICY "Authenticated can insert home section products"
      ON home_section_products FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_section_products' AND policyname = 'Authenticated can update home section products'
  ) THEN
    CREATE POLICY "Authenticated can update home section products"
      ON home_section_products FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'home_section_products' AND policyname = 'Authenticated can delete home section products'
  ) THEN
    CREATE POLICY "Authenticated can delete home section products"
      ON home_section_products FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
