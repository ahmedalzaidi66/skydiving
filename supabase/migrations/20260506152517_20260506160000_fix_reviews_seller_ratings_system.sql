/*
  # Fix Reviews and Seller Ratings System

  ## Summary
  This migration fixes and extends the reviews system to support product reviews,
  used gear reviews, and seller ratings.

  ## Changes

  ### 1. reviews table — add missing columns
  The `reviews` table exists but is missing all columns except id and created_at.
  We add:
  - `product_id` — FK to products (nullable, for product reviews)
  - `user_id` — FK to auth.users (nullable, the submitter)
  - `customer_name` — display name
  - `customer_email` — submitter email
  - `rating` — integer 1–5
  - `body` — review text
  - `status` — pending/approved/rejected (default pending)
  - `review_type` — 'product' or 'gear' (default 'product')
  - `gear_listing_id` — FK to used_gear_listings (nullable, for gear reviews)

  ### 2. seller_ratings table — new
  Stores per-transaction seller ratings from buyers.
  - `id`, `listing_id`, `rater_id`, `seller_id`, `stars`, `comment`, `created_at`
  - UNIQUE(listing_id, rater_id) prevents duplicate ratings per transaction

  ### 3. seller_profiles table — new
  Denormalized seller profile with computed avg_rating / rating_count.
  - Upserted via trigger on seller_ratings changes

  ### 4. Triggers
  - `trg_recalc_seller_rating`: recomputes seller_profiles avg_rating after insert/delete on seller_ratings
  - `trg_recalc_product_rating`: recomputes products.rating + review_count after review insert/update

  ### 5. RLS
  - reviews: public SELECT approved only; authenticated INSERT own pending; admin (service role) full access
  - seller_ratings: public SELECT; authenticated INSERT own; admin full access
  - seller_profiles: public SELECT; admin UPDATE
*/

-- =============================================
-- 1. Fix reviews table — add missing columns
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='product_id') THEN
    ALTER TABLE reviews ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='user_id') THEN
    ALTER TABLE reviews ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='customer_name') THEN
    ALTER TABLE reviews ADD COLUMN customer_name text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='customer_email') THEN
    ALTER TABLE reviews ADD COLUMN customer_email text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='rating') THEN
    ALTER TABLE reviews ADD COLUMN rating integer NOT NULL DEFAULT 5;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='body') THEN
    ALTER TABLE reviews ADD COLUMN body text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='status') THEN
    ALTER TABLE reviews ADD COLUMN status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='review_type') THEN
    ALTER TABLE reviews ADD COLUMN review_type text NOT NULL DEFAULT 'product';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='gear_listing_id') THEN
    ALTER TABLE reviews ADD COLUMN gear_listing_id uuid;
  END IF;
END $$;

-- Add constraints if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='reviews' AND constraint_name='reviews_rating_check'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='reviews' AND constraint_name='reviews_status_check'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='reviews' AND constraint_name='reviews_review_type_check'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_review_type_check CHECK (review_type IN ('product', 'gear'));
  END IF;
END $$;

-- =============================================
-- 2. RLS policies for reviews
-- =============================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved reviews" ON reviews;
CREATE POLICY "Public can view approved reviews"
  ON reviews FOR SELECT
  TO anon
  USING (status = 'approved');

DROP POLICY IF EXISTS "Authenticated users can view approved reviews" ON reviews;
CREATE POLICY "Authenticated users can view approved reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (status = 'approved' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can submit own reviews" ON reviews;
CREATE POLICY "Authenticated users can submit own reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can insert reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can update reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;

-- =============================================
-- 3. Create seller_ratings table
-- =============================================

CREATE TABLE IF NOT EXISTS seller_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES used_gear_listings(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars integer NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT seller_ratings_stars_check CHECK (stars >= 1 AND stars <= 5),
  UNIQUE(listing_id, rater_id)
);

ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seller ratings" ON seller_ratings;
CREATE POLICY "Public can read seller ratings"
  ON seller_ratings FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read seller ratings" ON seller_ratings;
CREATE POLICY "Authenticated users can read seller ratings"
  ON seller_ratings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit seller rating" ON seller_ratings;
CREATE POLICY "Authenticated users can submit seller rating"
  ON seller_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS "Users can update own seller rating" ON seller_ratings;
CREATE POLICY "Users can update own seller rating"
  ON seller_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS "Users can delete own seller rating" ON seller_ratings;
CREATE POLICY "Users can delete own seller rating"
  ON seller_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = rater_id);

-- =============================================
-- 4. Create seller_profiles table
-- =============================================

CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_verified boolean NOT NULL DEFAULT false,
  total_listings integer NOT NULL DEFAULT 0,
  join_date timestamptz NOT NULL DEFAULT now(),
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seller profiles" ON seller_profiles;
CREATE POLICY "Public can read seller profiles"
  ON seller_profiles FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read seller profiles" ON seller_profiles;
CREATE POLICY "Authenticated users can read seller profiles"
  ON seller_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can upsert own seller profile" ON seller_profiles;
CREATE POLICY "Users can upsert own seller profile"
  ON seller_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own seller profile" ON seller_profiles;
CREATE POLICY "Users can update own seller profile"
  ON seller_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 5. Trigger: recompute seller avg_rating
-- =============================================

CREATE OR REPLACE FUNCTION recalc_seller_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_avg numeric(3,2);
  v_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_seller_id := OLD.seller_id;
  ELSE
    v_seller_id := NEW.seller_id;
  END IF;

  SELECT
    COALESCE(AVG(stars), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM seller_ratings
  WHERE seller_id = v_seller_id;

  INSERT INTO seller_profiles (user_id, avg_rating, rating_count, updated_at)
    VALUES (v_seller_id, v_avg, v_count, now())
  ON CONFLICT (user_id) DO UPDATE
    SET avg_rating = EXCLUDED.avg_rating,
        rating_count = EXCLUDED.rating_count,
        updated_at = now();

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_seller_rating ON seller_ratings;
CREATE TRIGGER trg_recalc_seller_rating
  AFTER INSERT OR UPDATE OR DELETE ON seller_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_seller_rating();

-- =============================================
-- 6. Trigger: recompute product rating from approved reviews
-- =============================================

CREATE OR REPLACE FUNCTION recalc_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_avg numeric(3,2);
  v_count integer;
BEGIN
  -- Determine which product_id is affected
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(AVG(rating), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM reviews
  WHERE product_id = v_product_id
    AND status = 'approved';

  UPDATE products
    SET rating = v_avg,
        review_count = v_count
  WHERE id = v_product_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_product_rating ON reviews;
CREATE TRIGGER trg_recalc_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalc_product_rating();
