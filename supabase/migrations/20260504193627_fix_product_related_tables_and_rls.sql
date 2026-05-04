/*
  # Fix product_images, product_translations, product_color_variants

  ## Summary
  - product_images: missing all columns except id/created_at, no RLS policies
  - product_translations: missing all columns except id/created_at, no RLS policies
  - product_color_variants: table does not exist at all
  All three are written during product save in the admin. This migration adds
  all required columns and simple RLS (public read, authenticated write).

  ## Changes
  1. product_images — add product_id, url, is_main, sort_order + RLS
  2. product_translations — add product_id, language, name, descriptions + RLS
  3. product_color_variants — create table with all columns + RLS
*/

-- ── product_images ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='product_id') THEN
    ALTER TABLE product_images ADD COLUMN product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='url') THEN
    ALTER TABLE product_images ADD COLUMN url text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='is_main') THEN
    ALTER TABLE product_images ADD COLUMN is_main boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='sort_order') THEN
    ALTER TABLE product_images ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

DROP POLICY IF EXISTS "Public can read product images" ON product_images;
CREATE POLICY "Public can read product images"
  ON product_images FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can write product images" ON product_images;
CREATE POLICY "Authenticated can write product images"
  ON product_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update product images" ON product_images;
CREATE POLICY "Authenticated can update product images"
  ON product_images FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete product images" ON product_images;
CREATE POLICY "Authenticated can delete product images"
  ON product_images FOR DELETE
  TO authenticated
  USING (true);

-- ── product_translations ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='product_id') THEN
    ALTER TABLE product_translations ADD COLUMN product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='language') THEN
    ALTER TABLE product_translations ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='name') THEN
    ALTER TABLE product_translations ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='short_description') THEN
    ALTER TABLE product_translations ADD COLUMN short_description text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='full_description') THEN
    ALTER TABLE product_translations ADD COLUMN full_description text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='meta_title') THEN
    ALTER TABLE product_translations ADD COLUMN meta_title text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_translations' AND column_name='meta_description') THEN
    ALTER TABLE product_translations ADD COLUMN meta_description text NOT NULL DEFAULT '';
  END IF;
END $$;

ALTER TABLE product_translations DROP CONSTRAINT IF EXISTS product_translations_product_id_language_key;
ALTER TABLE product_translations ADD CONSTRAINT product_translations_product_id_language_key UNIQUE (product_id, language);

CREATE INDEX IF NOT EXISTS idx_product_translations_product_id ON product_translations (product_id);

DROP POLICY IF EXISTS "Public can read product translations" ON product_translations;
CREATE POLICY "Public can read product translations"
  ON product_translations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can write product translations" ON product_translations;
CREATE POLICY "Authenticated can write product translations"
  ON product_translations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update product translations" ON product_translations;
CREATE POLICY "Authenticated can update product translations"
  ON product_translations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete product translations" ON product_translations;
CREATE POLICY "Authenticated can delete product translations"
  ON product_translations FOR DELETE
  TO authenticated
  USING (true);

-- ── product_color_variants ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_color_variants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text        NOT NULL DEFAULT '',
  hex         text        NOT NULL DEFAULT '#808080',
  image_url   text,
  is_default  boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  stock       integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_color_variants_product_id ON product_color_variants (product_id);

ALTER TABLE product_color_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read color variants"
  ON product_color_variants FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can write color variants"
  ON product_color_variants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update color variants"
  ON product_color_variants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete color variants"
  ON product_color_variants FOR DELETE
  TO authenticated
  USING (true);
