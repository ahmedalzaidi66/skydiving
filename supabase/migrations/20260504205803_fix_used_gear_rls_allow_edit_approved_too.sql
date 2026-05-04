/*
  # Extend used_gear_listings UPDATE policy to include approved listings

  Users editing an approved listing (which reverts it to pending) was blocked
  because the USING clause only allowed status IN ('pending', 'rejected').
  This extends it to also allow editing approved listings.

  The WITH CHECK still enforces that the resulting status = 'pending', so
  users cannot self-approve.
*/

DROP POLICY IF EXISTS "Users can update own pending or rejected listings" ON public.used_gear_listings;

CREATE POLICY "Users can update own non-sold listings"
  ON public.used_gear_listings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('pending', 'rejected', 'approved')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );
