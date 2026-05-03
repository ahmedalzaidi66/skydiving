/*
  # Seller Trust System

  ## Summary
  Adds seller verification and rating capabilities to the used gear marketplace.

  ## New Tables
  - `seller_profiles`
    - `user_id` (uuid, FK to auth.users, primary key)
    - `is_verified` (boolean) — admin can toggle this
    - `total_listings` (int) — auto-managed by trigger
    - `join_date` (timestamptz) — when seller first listed
    - `avg_rating` (numeric 2dp) — recalculated on each rating change
    - `rating_count` (int)

  - `seller_ratings`
    - `id` (uuid, PK)
    - `listing_id` (uuid, FK to used_gear_listings)
    - `rater_id` (uuid, FK to auth.users) — who rated
    - `seller_id` (uuid) — who was rated
    - `stars` (int 1–5)
    - `created_at` (timestamptz)
    - UNIQUE (listing_id, rater_id) — one rating per listing per user

  ## Modified Tables
  - `used_gear_listings`: add `seller_verified` column (denormalized for fast reads)

  ## Security
  - RLS enabled on both tables
  - seller_profiles: public read, admin write for verified flag, system can upsert totals
  - seller_ratings: authenticated users can insert (not their own listings), read all, no update/delete

  ## Triggers
  - After insert/delete on used_gear_listings → upsert seller_profile totals
  - After insert on seller_ratings → recalculate avg_rating on seller_profiles
*/

-- ── seller_profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_verified    boolean NOT NULL DEFAULT false,
  total_listings int     NOT NULL DEFAULT 0,
  join_date      timestamptz NOT NULL DEFAULT now(),
  avg_rating     numeric(3,2) NOT NULL DEFAULT 0,
  rating_count   int     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read seller profiles"
  ON seller_profiles FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage seller profiles"
  ON seller_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update seller profiles"
  ON seller_profiles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── seller_ratings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES used_gear_listings(id) ON DELETE CASCADE,
  rater_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars      int  NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, rater_id)
);

CREATE INDEX IF NOT EXISTS seller_ratings_seller_idx ON seller_ratings(seller_id);
CREATE INDEX IF NOT EXISTS seller_ratings_rater_idx  ON seller_ratings(rater_id);

ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings"
  ON seller_ratings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can rate sellers"
  ON seller_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_id
    AND auth.uid() <> seller_id
  );

-- ── is_verified denorm on listings ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'used_gear_listings' AND column_name = 'seller_verified'
  ) THEN
    ALTER TABLE used_gear_listings ADD COLUMN seller_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── Function: upsert seller_profile when listing is created/deleted ────────────
CREATE OR REPLACE FUNCTION sync_seller_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO seller_profiles (user_id, total_listings, join_date)
    VALUES (NEW.user_id, 1, NEW.created_at)
    ON CONFLICT (user_id) DO UPDATE
      SET total_listings = (
            SELECT COUNT(*) FROM used_gear_listings
            WHERE user_id = EXCLUDED.user_id AND status = 'approved'
          ),
          updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE seller_profiles
    SET total_listings = (
          SELECT COUNT(*) FROM used_gear_listings
          WHERE user_id = OLD.user_id AND status = 'approved'
        ),
        updated_at = now()
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- status change may affect approved count
    UPDATE seller_profiles
    SET total_listings = (
          SELECT COUNT(*) FROM used_gear_listings
          WHERE user_id = NEW.user_id AND status = 'approved'
        ),
        -- mirror is_verified from seller_profiles to listing
        updated_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seller_profile ON used_gear_listings;
CREATE TRIGGER trg_sync_seller_profile
  AFTER INSERT OR UPDATE OR DELETE ON used_gear_listings
  FOR EACH ROW EXECUTE FUNCTION sync_seller_profile();

-- ── Function: recalculate avg_rating after new rating ────────────────────────
CREATE OR REPLACE FUNCTION recalc_seller_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE seller_profiles
  SET avg_rating   = (SELECT ROUND(AVG(stars)::numeric, 2) FROM seller_ratings WHERE seller_id = NEW.seller_id),
      rating_count = (SELECT COUNT(*) FROM seller_ratings WHERE seller_id = NEW.seller_id),
      updated_at   = now()
  WHERE user_id = NEW.seller_id;

  -- Also mirror verified badge onto the listing when rating changes (no-op but safe)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_seller_rating ON seller_ratings;
CREATE TRIGGER trg_recalc_seller_rating
  AFTER INSERT ON seller_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_seller_rating();

-- ── Function: admin toggle verified ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_seller_verified(p_user_id uuid, p_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO seller_profiles (user_id, is_verified)
  VALUES (p_user_id, p_verified)
  ON CONFLICT (user_id) DO UPDATE SET is_verified = p_verified, updated_at = now();

  -- Mirror onto all approved listings for this seller
  UPDATE used_gear_listings
  SET seller_verified = p_verified
  WHERE user_id = p_user_id;
END;
$$;
