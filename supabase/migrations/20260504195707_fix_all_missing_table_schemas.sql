/*
  # Fix all missing table schemas for image/content persistence

  ## Problem
  Multiple tables were created with only id + created_at. Every save silently
  drops data because the target columns don't exist. This migration adds all
  missing columns to each table and sets up the minimum RLS required for
  authenticated admin writes and public reads.

  ## Tables fixed
  1. categories       — slug, image, active, sort_order, updated_at
  2. category_translations — category_id, language, name, description + unique constraint
  3. site_branding    — key, value, updated_at + unique constraint on key
  4. page_blocks      — layout_id, type, order_index, visible, content, updated_at
*/

-- ── 1. categories ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='slug') THEN
    ALTER TABLE categories ADD COLUMN slug text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='image') THEN
    ALTER TABLE categories ADD COLUMN image text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='active') THEN
    ALTER TABLE categories ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sort_order') THEN
    ALTER TABLE categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='updated_at') THEN
    ALTER TABLE categories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read categories" ON categories;
CREATE POLICY "Public can read categories"
  ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can insert categories" ON categories;
CREATE POLICY "Authenticated can insert categories"
  ON categories FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update categories" ON categories;
CREATE POLICY "Authenticated can update categories"
  ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete categories" ON categories;
CREATE POLICY "Authenticated can delete categories"
  ON categories FOR DELETE TO authenticated USING (true);

-- ── 2. category_translations ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='category_translations' AND column_name='category_id') THEN
    ALTER TABLE category_translations ADD COLUMN category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='category_translations' AND column_name='language') THEN
    ALTER TABLE category_translations ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='category_translations' AND column_name='name') THEN
    ALTER TABLE category_translations ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='category_translations' AND column_name='description') THEN
    ALTER TABLE category_translations ADD COLUMN description text NOT NULL DEFAULT '';
  END IF;
END $$;

ALTER TABLE category_translations DROP CONSTRAINT IF EXISTS category_translations_category_id_language_key;
ALTER TABLE category_translations ADD CONSTRAINT category_translations_category_id_language_key UNIQUE (category_id, language);

CREATE INDEX IF NOT EXISTS idx_category_translations_category_id ON category_translations (category_id);

ALTER TABLE category_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read category translations" ON category_translations;
CREATE POLICY "Public can read category translations"
  ON category_translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can write category translations" ON category_translations;
CREATE POLICY "Authenticated can write category translations"
  ON category_translations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update category translations" ON category_translations;
CREATE POLICY "Authenticated can update category translations"
  ON category_translations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete category translations" ON category_translations;
CREATE POLICY "Authenticated can delete category translations"
  ON category_translations FOR DELETE TO authenticated USING (true);

-- ── 3. site_branding ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_branding' AND column_name='key') THEN
    ALTER TABLE site_branding ADD COLUMN key text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_branding' AND column_name='value') THEN
    ALTER TABLE site_branding ADD COLUMN value text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_branding' AND column_name='updated_at') THEN
    ALTER TABLE site_branding ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

ALTER TABLE site_branding DROP CONSTRAINT IF EXISTS site_branding_key_key;
ALTER TABLE site_branding ADD CONSTRAINT site_branding_key_key UNIQUE (key);

ALTER TABLE site_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read site branding" ON site_branding;
CREATE POLICY "Public can read site branding"
  ON site_branding FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can insert site branding" ON site_branding;
CREATE POLICY "Authenticated can insert site branding"
  ON site_branding FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update site branding" ON site_branding;
CREATE POLICY "Authenticated can update site branding"
  ON site_branding FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete site branding" ON site_branding;
CREATE POLICY "Authenticated can delete site branding"
  ON site_branding FOR DELETE TO authenticated USING (true);

-- ── 4. page_blocks ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_blocks' AND column_name='layout_id') THEN
    ALTER TABLE page_blocks ADD COLUMN layout_id bigint REFERENCES page_layouts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_blocks' AND column_name='type') THEN
    ALTER TABLE page_blocks ADD COLUMN type text NOT NULL DEFAULT 'hero';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_blocks' AND column_name='order_index') THEN
    ALTER TABLE page_blocks ADD COLUMN order_index integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_blocks' AND column_name='visible') THEN
    ALTER TABLE page_blocks ADD COLUMN visible boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_blocks' AND column_name='content') THEN
    ALTER TABLE page_blocks ADD COLUMN content jsonb NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_blocks' AND column_name='updated_at') THEN
    ALTER TABLE page_blocks ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_page_blocks_layout_id ON page_blocks (layout_id);

ALTER TABLE page_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read page blocks" ON page_blocks;
CREATE POLICY "Public can read page blocks"
  ON page_blocks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can insert page blocks" ON page_blocks;
CREATE POLICY "Authenticated can insert page blocks"
  ON page_blocks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update page blocks" ON page_blocks;
CREATE POLICY "Authenticated can update page blocks"
  ON page_blocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete page blocks" ON page_blocks;
CREATE POLICY "Authenticated can delete page blocks"
  ON page_blocks FOR DELETE TO authenticated USING (true);
