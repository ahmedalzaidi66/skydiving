/*
  # Fix used_gear_listings RLS — simple policies, no admin dependency

  Replaces all existing policies with minimal, working ones:
  - Public can read ALL listings (no status filter)
  - Authenticated users can insert their own (user_id = auth.uid())
  - Authenticated users can update/delete their own pending listings
  No is_admin_request() anywhere.
*/

DROP POLICY IF EXISTS "Anyone can view approved listings" ON used_gear_listings;
DROP POLICY IF EXISTS "Users can view own listings" ON used_gear_listings;
DROP POLICY IF EXISTS "Admin can view all listings" ON used_gear_listings;
DROP POLICY IF EXISTS "Authenticated users can create listings" ON used_gear_listings;
DROP POLICY IF EXISTS "Users can update own pending listings" ON used_gear_listings;
DROP POLICY IF EXISTS "Admin can update any listing" ON used_gear_listings;
DROP POLICY IF EXISTS "Users can delete own pending listings" ON used_gear_listings;
DROP POLICY IF EXISTS "Admin can delete any listing" ON used_gear_listings;

-- Public can read all listings
CREATE POLICY "Public can read listings"
  ON used_gear_listings
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own listings
CREATE POLICY "Users can insert own listings"
  ON used_gear_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authenticated users can update their own pending listings
CREATE POLICY "Users can update own pending listings"
  ON used_gear_listings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Authenticated users can delete their own pending listings
CREATE POLICY "Users can delete own pending listings"
  ON used_gear_listings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');
