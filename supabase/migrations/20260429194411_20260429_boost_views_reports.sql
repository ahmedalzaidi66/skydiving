/*
  # Paid Boost System, View Counts, and Listing Reports

  ## New Tables

  ### listing_boosts
  - Tracks boost requests per listing
  - status: pending_payment | boosted | expired
  - admin controls price and duration via site_settings

  ### listing_views
  - Deduplicated view tracking (one row per listing+viewer fingerprint per day)
  - Used to show view counts without counting rapid refreshes

  ### listing_reports
  - User-submitted reports for suspicious/fake listings
  - Fields: reason, message, reporter_phone
  - Admin can dismiss or hide the listing

  ## Changes to used_gear_listings
  - Add view_count (denormalized, updated by trigger)
  - Add boost_status (mirrors active boost)
  - Add boost_expires_at

  ## Security
  - RLS enabled on all new tables
  - Authenticated users can insert views and reports
  - Only admin (is_admin_request) can manage boosts and read reports
*/

-- ── used_gear_listings: boost and view columns ────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='used_gear_listings' AND column_name='view_count') THEN
    ALTER TABLE used_gear_listings ADD COLUMN view_count integer DEFAULT 0 NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='used_gear_listings' AND column_name='boost_status') THEN
    ALTER TABLE used_gear_listings ADD COLUMN boost_status text DEFAULT NULL CHECK (boost_status IS NULL OR boost_status IN ('pending_payment','boosted','expired'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='used_gear_listings' AND column_name='boost_expires_at') THEN
    ALTER TABLE used_gear_listings ADD COLUMN boost_expires_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- ── listing_boosts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS listing_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES used_gear_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','boosted','expired')),
  price_paid numeric(10,2) DEFAULT 0,
  duration_days integer DEFAULT 7,
  boosted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE listing_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own boost requests"
  ON listing_boosts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own boost requests"
  ON listing_boosts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all boosts"
  ON listing_boosts FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Admins can update boosts"
  ON listing_boosts FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ── listing_views ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES used_gear_listings(id) ON DELETE CASCADE,
  viewer_key text NOT NULL,
  viewed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (listing_id, viewer_key, viewed_date)
);

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views"
  ON listing_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read views"
  ON listing_views FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

-- Function to increment view_count on new unique view
CREATE OR REPLACE FUNCTION increment_listing_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE used_gear_listings
  SET view_count = view_count + 1
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_listing_view ON listing_views;
CREATE TRIGGER on_new_listing_view
  AFTER INSERT ON listing_views
  FOR EACH ROW EXECUTE FUNCTION increment_listing_view_count();

-- ── listing_reports ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES used_gear_listings(id) ON DELETE CASCADE,
  reporter_id uuid,
  reporter_email text,
  reason text NOT NULL,
  message text,
  reporter_phone text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','acted')),
  admin_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can submit reports"
  ON listing_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Anon users can submit reports"
  ON listing_reports FOR INSERT
  TO anon
  WITH CHECK (reporter_id IS NULL);

CREATE POLICY "Admins can read all reports"
  ON listing_reports FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Admins can update reports"
  ON listing_reports FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ── site_settings: boost defaults ────────────────────────────────────────────

INSERT INTO site_settings (key, value) VALUES ('boost_price_usd', '9.99') ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('boost_duration_days', '7') ON CONFLICT (key) DO NOTHING;
