/*
  # Used Gear: sold status, monthly reminder, looser user-edit RLS

  ## Changes

  ### used_gear_listings
  1. Add 'sold' to the status CHECK constraint
  2. Add `last_reminder_sent_at` column for the 30-day reminder system
  3. Widen the user UPDATE policy so sellers can edit their own listing
     regardless of current status (pending/approved/rejected — but NOT sold),
     and the edit always resets status to 'pending'.

  ## Security
  - Sellers can only update rows where user_id = auth.uid() AND status != 'sold'
  - WITH CHECK enforces status = 'pending' so they cannot self-approve
  - All other existing policies are unchanged
*/

-- 1. Widen status CHECK to include 'sold'
ALTER TABLE used_gear_listings
  DROP CONSTRAINT IF EXISTS used_gear_listings_status_check;

ALTER TABLE used_gear_listings
  ADD CONSTRAINT used_gear_listings_status_check
  CHECK (status IN ('pending','approved','rejected','sold'));

-- 2. Add reminder timestamp column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'used_gear_listings' AND column_name = 'last_reminder_sent_at'
  ) THEN
    ALTER TABLE used_gear_listings ADD COLUMN last_reminder_sent_at timestamptz;
  END IF;
END $$;

-- 3. Drop the old restrictive user update policy and replace it
DROP POLICY IF EXISTS "Users can update own pending listings" ON used_gear_listings;

-- Sellers can edit their own non-sold listings; save always resets status to pending
CREATE POLICY "Users can update own non-sold listings"
  ON used_gear_listings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status != 'sold'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Sellers can mark their own approved listings as sold
CREATE POLICY "Users can mark own listing as sold"
  ON used_gear_listings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'approved'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'sold'
  );
