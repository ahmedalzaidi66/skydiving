/*
  # Add all missing columns to products table

  ## Summary
  The products table exists but only has id and created_at.
  This migration adds every column the admin products save function writes,
  matching the Product type in lib/supabase.ts exactly.

  ## Changes to products table
  - name, slug, price, compare_price, category, category_id
  - rating, review_count, description, image_url, main_image, images
  - stock, unlimited_stock, low_stock_threshold, badge, is_featured, featured
  - status, sku, specifications
  - Legacy translation columns: name_ar, name_es, name_de, description_ar, description_es, description_de

  ## Security
  - Existing RLS policies kept (public read, authenticated write)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='name') THEN
    ALTER TABLE products ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='slug') THEN
    ALTER TABLE products ADD COLUMN slug text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price') THEN
    ALTER TABLE products ADD COLUMN price numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='compare_price') THEN
    ALTER TABLE products ADD COLUMN compare_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
    ALTER TABLE products ADD COLUMN category text NOT NULL DEFAULT 'accessories';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
    ALTER TABLE products ADD COLUMN category_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='rating') THEN
    ALTER TABLE products ADD COLUMN rating numeric NOT NULL DEFAULT 4.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='review_count') THEN
    ALTER TABLE products ADD COLUMN review_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description') THEN
    ALTER TABLE products ADD COLUMN description text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
    ALTER TABLE products ADD COLUMN image_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='main_image') THEN
    ALTER TABLE products ADD COLUMN main_image text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='images') THEN
    ALTER TABLE products ADD COLUMN images text[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock') THEN
    ALTER TABLE products ADD COLUMN stock integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unlimited_stock') THEN
    ALTER TABLE products ADD COLUMN unlimited_stock boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='low_stock_threshold') THEN
    ALTER TABLE products ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='badge') THEN
    ALTER TABLE products ADD COLUMN badge text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_featured') THEN
    ALTER TABLE products ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='featured') THEN
    ALTER TABLE products ADD COLUMN featured boolean;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='status') THEN
    ALTER TABLE products ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active','draft','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sku') THEN
    ALTER TABLE products ADD COLUMN sku text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='specifications') THEN
    ALTER TABLE products ADD COLUMN specifications jsonb;
  END IF;
  -- Legacy translation columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='name_ar') THEN
    ALTER TABLE products ADD COLUMN name_ar text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='name_es') THEN
    ALTER TABLE products ADD COLUMN name_es text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='name_de') THEN
    ALTER TABLE products ADD COLUMN name_de text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description_ar') THEN
    ALTER TABLE products ADD COLUMN description_ar text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description_es') THEN
    ALTER TABLE products ADD COLUMN description_es text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description_de') THEN
    ALTER TABLE products ADD COLUMN description_de text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products (is_featured);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
