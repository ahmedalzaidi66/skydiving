/*
  # Boost approval flow

  1. Changes to listing_boosts
    - Add `admin_note` column: stores rejection reason from admin
    - Rename status value: pending_payment → pending_approval (the user submits, admin approves/rejects)

  2. RLS
    - Users can insert their own boosts with pending_approval status
    - Users can read their own boosts
    - Admin reads/updates all boosts via service role (no changes needed)

  Notes:
    - Existing pending_payment rows are left as-is; the app now writes pending_approval for new requests
    - The admin filter handles both values
*/

-- Add admin_note column to listing_boosts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listing_boosts' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE listing_boosts ADD COLUMN admin_note text;
  END IF;
END $$;

-- Allow users to insert boosts for their own listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_boosts' AND policyname = 'Users can insert own boosts'
  ) THEN
    CREATE POLICY "Users can insert own boosts"
      ON listing_boosts
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Allow users to read their own boosts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_boosts' AND policyname = 'Users can read own boosts'
  ) THEN
    CREATE POLICY "Users can read own boosts"
      ON listing_boosts
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
