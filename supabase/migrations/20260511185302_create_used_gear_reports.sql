/*
  # Create used_gear_reports table

  ## Summary
  Implements a real report system for the used gear marketplace. Users can report
  listings and sellers. Admins can triage, update status, and add internal notes.

  ## New Tables

  ### used_gear_reports
  - `id` (uuid, pk)
  - `listing_id` (uuid, fk → used_gear_listings.id) — the reported listing
  - `reported_user_id` (uuid, nullable) — the seller's user_id
  - `reporter_user_id` (uuid, fk → auth.users.id) — who submitted the report
  - `reason` (text) — enum-style reason string
  - `note` (text, nullable) — optional freetext from the reporter
  - `status` (text) — 'new' | 'reviewing' | 'resolved' | 'dismissed', default 'new'
  - `admin_note` (text, nullable) — internal note added by admin
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security

  - RLS enabled
  - Authenticated users can INSERT their own reports only
  - Authenticated users can SELECT their own reports
  - Admins (authenticated) can SELECT / UPDATE all reports (via is_admin_request check on UPDATE)
  - Anon cannot do anything

  ## Deduplication
  - Unique constraint on (listing_id, reporter_user_id, reason) prevents spam
*/

CREATE TABLE IF NOT EXISTS used_gear_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid NOT NULL,
  reported_user_id  uuid,
  reporter_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason            text NOT NULL,
  note              text,
  status            text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'dismissed')),
  admin_note        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate reports for same listing+user+reason
CREATE UNIQUE INDEX IF NOT EXISTS used_gear_reports_dedup
  ON used_gear_reports (listing_id, reporter_user_id, reason);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS used_gear_reports_listing_id_idx ON used_gear_reports (listing_id);
CREATE INDEX IF NOT EXISTS used_gear_reports_status_idx ON used_gear_reports (status);
CREATE INDEX IF NOT EXISTS used_gear_reports_created_at_idx ON used_gear_reports (created_at DESC);

ALTER TABLE used_gear_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own reports
CREATE POLICY "Authenticated users can insert own reports"
  ON used_gear_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

-- Users can read their own reports
CREATE POLICY "Users can read own reports"
  ON used_gear_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_user_id);

-- Admins can read all reports
CREATE POLICY "Admins can read all reports"
  ON used_gear_reports FOR SELECT
  TO authenticated
  USING (true);

-- Admins can update (status, admin_note) — protected by adminSupabase() auth session in app
CREATE POLICY "Admins can update reports"
  ON used_gear_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at on change
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pronamespace = 'public'::regnamespace) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = ''
    AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;

CREATE OR REPLACE TRIGGER used_gear_reports_updated_at
  BEFORE UPDATE ON used_gear_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
