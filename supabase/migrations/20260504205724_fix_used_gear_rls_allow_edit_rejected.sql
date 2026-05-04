/*
  # Fix used_gear_listings RLS: allow users to update rejected listings

  The existing UPDATE policy only permits updates when status = 'pending',
  which means users could never save edits to a rejected listing and
  resubmit it for review.

  Changes:
  - Drop the old restrictive UPDATE policy
  - Add new UPDATE policy: owner can update when status is 'pending' OR 'rejected'
  - The WITH CHECK enforces that after the update the status must be 'pending'
    (prevents user from self-approving)
*/

DROP POLICY IF EXISTS "Users can update own pending listings" ON public.used_gear_listings;

CREATE POLICY "Users can update own pending or rejected listings"
  ON public.used_gear_listings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('pending', 'rejected')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );
