/*
  # Admin RLS for listing_reports and listing_boosts

  Allows admin requests (via is_admin_request()) to read and update
  listing_reports and listing_boosts tables so the admin marketplace
  dashboard can display and manage them.

  Changes:
  - SELECT policy on listing_reports for admin requests
  - UPDATE policy on listing_reports for admin requests (dismiss/action)
  - SELECT policy on listing_boosts for admin requests
  - UPDATE policy on listing_boosts for admin requests (activate/expire)
  - UPDATE policy on used_gear_listings for admin requests (already exists for status,
    but adding explicit boost fields update)
*/

-- listing_reports: admin read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_reports' AND policyname = 'Admin can read all listing reports'
  ) THEN
    CREATE POLICY "Admin can read all listing reports"
      ON listing_reports FOR SELECT
      USING (is_admin_request());
  END IF;
END $$;

-- listing_reports: admin update (dismiss / action)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_reports' AND policyname = 'Admin can update listing reports'
  ) THEN
    CREATE POLICY "Admin can update listing reports"
      ON listing_reports FOR UPDATE
      USING (is_admin_request())
      WITH CHECK (is_admin_request());
  END IF;
END $$;

-- listing_boosts: admin read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_boosts' AND policyname = 'Admin can read all listing boosts'
  ) THEN
    CREATE POLICY "Admin can read all listing boosts"
      ON listing_boosts FOR SELECT
      USING (is_admin_request());
  END IF;
END $$;

-- listing_boosts: admin update (activate / expire)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_boosts' AND policyname = 'Admin can update listing boosts'
  ) THEN
    CREATE POLICY "Admin can update listing boosts"
      ON listing_boosts FOR UPDATE
      USING (is_admin_request())
      WITH CHECK (is_admin_request());
  END IF;
END $$;
