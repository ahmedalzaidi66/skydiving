/*
  # Create Used Gear Marketplace

  ## Summary
  Adds a peer-to-peer used gear listing system. Users can post gear for sale;
  listings are held in 'pending' status until an admin approves or rejects them.
  Only 'approved' listings are visible on the storefront.

  ## New Tables

  ### used_gear_listings
  Stores all used gear listings submitted by users.

  | Column         | Type      | Description                                      |
  |----------------|-----------|--------------------------------------------------|
  | id             | uuid PK   | Auto-generated primary key                       |
  | user_id        | uuid      | auth.uid() of the submitting user                |
  | user_email     | text      | Email of submitting user (denormalised for admin)|
  | title          | text      | Listing title                                    |
  | category       | text      | Gear category slug                               |
  | price          | numeric   | Asking price in USD                              |
  | condition      | text      | One of: new, like_new, good, fair, poor          |
  | description    | text      | Full description                                 |
  | contact        | text      | WhatsApp number or phone                         |
  | images         | text[]    | Array of image URLs                              |
  | status         | text      | pending | approved | rejected                    |
  | admin_note     | text      | Optional rejection/approval note from admin      |
  | created_at     | timestamptz | Row creation time                              |
  | updated_at     | timestamptz | Last update time                               |

  ## Security
  - RLS enabled — restrictive by default
  - SELECT: anyone can read 'approved' listings; authenticated users can read their own
  - INSERT: authenticated users only, forced status = 'pending'
  - UPDATE (own): authenticated users can update their own pending listings
  - UPDATE (admin): admin can update status/note on any listing
  - DELETE (admin): admin can delete any listing
  - DELETE (own): authenticated users can delete their own pending listings
*/

CREATE TABLE IF NOT EXISTS used_gear_listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  user_email   text NOT NULL,
  title        text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  category     text NOT NULL DEFAULT '',
  price        numeric NOT NULL CHECK (price >= 0),
  condition    text NOT NULL DEFAULT 'good'
                CHECK (condition IN ('new','like_new','good','fair','poor')),
  description  text NOT NULL DEFAULT '',
  contact      text NOT NULL DEFAULT '',
  images       text[] NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  admin_note   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for storefront query (approved only, newest first)
CREATE INDEX IF NOT EXISTS idx_used_gear_approved
  ON used_gear_listings (status, created_at DESC);

-- Index for user's own listings
CREATE INDEX IF NOT EXISTS idx_used_gear_user
  ON used_gear_listings (user_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_used_gear_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_used_gear_updated_at ON used_gear_listings;
CREATE TRIGGER trg_used_gear_updated_at
  BEFORE UPDATE ON used_gear_listings
  FOR EACH ROW EXECUTE FUNCTION update_used_gear_updated_at();

-- Enable RLS
ALTER TABLE used_gear_listings ENABLE ROW LEVEL SECURITY;

-- ── SELECT policies ───────────────────────────────────────────────────────────

-- Anyone (including anon) can see approved listings
CREATE POLICY "Anyone can view approved listings"
  ON used_gear_listings
  FOR SELECT
  USING (status = 'approved');

-- Authenticated users can view their own listings (any status)
CREATE POLICY "Users can view own listings"
  ON used_gear_listings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can view all listings
CREATE POLICY "Admin can view all listings"
  ON used_gear_listings
  FOR SELECT
  USING (is_admin_request());

-- ── INSERT policy ─────────────────────────────────────────────────────────────

CREATE POLICY "Authenticated users can create listings"
  ON used_gear_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND user_email = (auth.jwt() ->> 'email')
    AND status = 'pending'
  );

-- ── UPDATE policies ───────────────────────────────────────────────────────────

-- Users can edit their own pending listings (not change status)
CREATE POLICY "Users can update own pending listings"
  ON used_gear_listings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Admin can update any listing (approve/reject/edit)
CREATE POLICY "Admin can update any listing"
  ON used_gear_listings
  FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ── DELETE policies ───────────────────────────────────────────────────────────

-- Users can delete their own pending listings
CREATE POLICY "Users can delete own pending listings"
  ON used_gear_listings
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Admin can delete any listing
CREATE POLICY "Admin can delete any listing"
  ON used_gear_listings
  FOR DELETE
  USING (is_admin_request());
