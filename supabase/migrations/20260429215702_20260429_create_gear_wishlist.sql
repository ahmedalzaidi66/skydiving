/*
  # Create gear_wishlist table

  1. New Tables
    - `gear_wishlist`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `listing_id` (uuid, references used_gear_listings)
      - `created_at` (timestamptz)
      - UNIQUE constraint on (user_id, listing_id)

  2. Security
    - Enable RLS
    - Users can SELECT, INSERT, DELETE their own rows only
*/

CREATE TABLE IF NOT EXISTS gear_wishlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES used_gear_listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

ALTER TABLE gear_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gear wishlist"
  ON gear_wishlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to gear wishlist"
  ON gear_wishlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from gear wishlist"
  ON gear_wishlist FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
