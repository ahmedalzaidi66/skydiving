/*
  # Re-boost support

  1. Changes
    - Add `reboost_discount_pct` to site_settings (default 50 = 50% of original price)
    - Add `is_reboost` boolean column to listing_boosts to distinguish re-boost requests

  2. Notes
    - Re-boost creates a new row (preserves history)
    - Admin approves re-boost same as a normal boost
    - On approve, boost timestamp is updated to now (listing jumps to top)
*/

INSERT INTO site_settings (key, value)
VALUES ('reboost_discount_pct', '50')
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listing_boosts' AND column_name = 'is_reboost'
  ) THEN
    ALTER TABLE listing_boosts ADD COLUMN is_reboost boolean DEFAULT false;
  END IF;
END $$;
