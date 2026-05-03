/*
  # Fix: ensure admin can read all used_gear_listings regardless of status

  ## Problem
  The existing "Admin can view all listings" SELECT policy uses is_admin_request()
  which checks for x-admin-token in PostgREST request headers. The admin marketplace
  page was calling fetchListings() with the plain supabase client (no x-admin-token),
  so only approved listings and the admin's own listings were returned — pending
  submissions from other users were invisible.

  ## Fix
  Add a fallback SELECT policy that allows any authenticated user whose auth.uid()
  matches an active employee row to read all listings. The admin JS client always
  holds a valid Supabase Auth session after login, so this policy fires correctly.

  ## Security
  - Only active employees can use this policy
  - The policy is additive — existing public "approved" visibility is unchanged
  - No impact on normal store products, checkout, or upload system
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'used_gear_listings'
      AND policyname = 'Active employees can read all used gear listings'
  ) THEN
    CREATE POLICY "Active employees can read all used gear listings"
      ON used_gear_listings
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM employees
          WHERE employees.auth_user_id = auth.uid()
            AND employees.is_active = true
        )
      );
  END IF;
END $$;
