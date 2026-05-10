/*
  # Fix hero_slides RLS policies

  ## Problem
  The existing policies were scoped to `anon` role only.
  Admin users log in via Supabase Auth, so their requests arrive as the
  `authenticated` role — the anon-only INSERT/UPDATE/DELETE policies never
  applied to them, causing every admin write to be rejected silently.

  The public SELECT policy was on `public` (both anon + authenticated) which
  is correct, but the duplicate anon SELECT policy caused conflicts.

  ## Changes
  1. Drop all existing hero_slides policies
  2. Re-create with correct role scoping:
     - Public read (is_active = true): anon + authenticated → use TO public
     - Admin full read (all rows): authenticated only
     - Admin write (insert/update/delete): authenticated only
*/

-- Drop all existing policies on hero_slides
DROP POLICY IF EXISTS "Anyone can view active hero slides" ON hero_slides;
DROP POLICY IF EXISTS "Admins can view all hero slides" ON hero_slides;
DROP POLICY IF EXISTS "Admins can insert hero slides" ON hero_slides;
DROP POLICY IF EXISTS "Admins can update hero slides" ON hero_slides;
DROP POLICY IF EXISTS "Admins can delete hero slides" ON hero_slides;

-- Public storefront: any visitor (anon or logged-in) can read active slides
CREATE POLICY "Public can read active hero slides"
  ON hero_slides FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admin: authenticated users can read ALL slides (including inactive)
CREATE POLICY "Authenticated can read all hero slides"
  ON hero_slides FOR SELECT
  TO authenticated
  USING (true);

-- Admin: authenticated users can insert slides
CREATE POLICY "Authenticated can insert hero slides"
  ON hero_slides FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin: authenticated users can update slides
CREATE POLICY "Authenticated can update hero slides"
  ON hero_slides FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admin: authenticated users can delete slides
CREATE POLICY "Authenticated can delete hero slides"
  ON hero_slides FOR DELETE
  TO authenticated
  USING (true);
