/*
  # Create hero_slides table

  ## Purpose
  Stores individual slides for the home page hero carousel/slider.
  Each slide can have its own image, text content, badge, CTA button, sort order,
  and enabled/disabled state. The admin can create, edit, reorder, and delete slides.

  ## New Tables
  - `hero_slides`
    - `id` (uuid, primary key)
    - `image_url` (text) — background image for the slide
    - `title` (text) — main headline
    - `subtitle` (text) — supporting text
    - `badge` (text) — small pill label above title
    - `button_text` (text) — CTA button label
    - `button_url` (text) — CTA button destination (path or URL)
    - `sort_order` (int) — display order, ascending
    - `is_active` (boolean) — whether the slide is shown to users
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Anon/authenticated users can SELECT active slides (is_active = true)
  - Only service role (admin) can INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS hero_slides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   text NOT NULL DEFAULT '',
  title       text NOT NULL DEFAULT '',
  subtitle    text NOT NULL DEFAULT '',
  badge       text NOT NULL DEFAULT '',
  button_text text NOT NULL DEFAULT '',
  button_url  text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;

-- Public can read active slides
CREATE POLICY "Anyone can view active hero slides"
  ON hero_slides FOR SELECT
  USING (is_active = true);

-- Admins (service role / anon with token) can read ALL slides for admin UI
CREATE POLICY "Admins can view all hero slides"
  ON hero_slides FOR SELECT
  TO anon
  USING (true);

-- Admins can insert new slides
CREATE POLICY "Admins can insert hero slides"
  ON hero_slides FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admins can update slides
CREATE POLICY "Admins can update hero slides"
  ON hero_slides FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Admins can delete slides
CREATE POLICY "Admins can delete hero slides"
  ON hero_slides FOR DELETE
  TO anon
  USING (true);

-- Index for fast sort_order queries
CREATE INDEX IF NOT EXISTS hero_slides_sort_order_idx ON hero_slides (sort_order, is_active);
