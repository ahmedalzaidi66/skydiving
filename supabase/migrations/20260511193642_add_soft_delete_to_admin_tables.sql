/*
  # Soft Delete for Admin-Managed Data

  ## Summary
  Adds `deleted_at` timestamp columns to important admin-managed tables so
  records are never hard-deleted. Soft-deleted rows are hidden from storefront
  queries via RLS / view filters. Admins can see and restore them.

  ## Tables Modified
  - `products`            — add deleted_at
  - `categories`          — add deleted_at
  - `coupons`             — add deleted_at
  - `hero_slides`         — add deleted_at
  - `used_gear_listings`  — add deleted_at (in addition to status=hidden)

  ## Storefront Visibility
  - Existing public SELECT policies already filter on status='active'; the
    deleted_at column adds an extra guard.
  - Updated RLS policies include `deleted_at IS NULL` for public reads.

  ## Admin Visibility
  - Admin reads use is_admin_request() and can see deleted rows (omit filter).
*/

-- products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE products ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- coupons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coupons' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE coupons ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- hero_slides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hero_slides' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE hero_slides ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- used_gear_listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'used_gear_listings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE used_gear_listings ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Storefront: hide soft-deleted products from public reads
-- (The existing "public product read" policy uses USING(true); tighten it)
DROP POLICY IF EXISTS "public product read" ON products;
CREATE POLICY "public product read"
  ON products FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND deleted_at IS NULL);

-- Storefront: hide soft-deleted categories
DROP POLICY IF EXISTS "Public can read categories" ON categories;
CREATE POLICY "Public can read categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

-- Hero slides: hide soft-deleted
DROP POLICY IF EXISTS "Anyone can view active hero slides" ON hero_slides;
CREATE POLICY "Anyone can view active hero slides"
  ON hero_slides FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND deleted_at IS NULL);
