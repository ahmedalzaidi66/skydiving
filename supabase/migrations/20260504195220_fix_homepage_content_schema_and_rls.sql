/*
  # Fix homepage_content table — add missing key/value CMS columns and RLS

  ## Problem
  The homepage_content table only has id, created_at, image_url, background_image_url.
  The admin hero editor upserts rows keyed by (section, key, language) — all three
  columns are missing, causing every save to silently fail with a column-not-found error.
  RLS is enabled but has no policies so reads also return nothing.

  ## Changes
  1. Add columns: section, key, value, language, updated_at
  2. Add unique constraint on (section, key, language) for upsert conflict target
  3. Add RLS policies: public read, authenticated write
  4. Seed a default hero row so the storefront shows an image on first load
*/

-- Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='homepage_content' AND column_name='section') THEN
    ALTER TABLE homepage_content ADD COLUMN section text NOT NULL DEFAULT 'hero';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='homepage_content' AND column_name='key') THEN
    ALTER TABLE homepage_content ADD COLUMN key text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='homepage_content' AND column_name='value') THEN
    ALTER TABLE homepage_content ADD COLUMN value text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='homepage_content' AND column_name='language') THEN
    ALTER TABLE homepage_content ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='homepage_content' AND column_name='updated_at') THEN
    ALTER TABLE homepage_content ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Unique constraint required by upsert onConflict: 'section,key,language'
ALTER TABLE homepage_content
  DROP CONSTRAINT IF EXISTS homepage_content_section_key_language_key;

ALTER TABLE homepage_content
  ADD CONSTRAINT homepage_content_section_key_language_key
  UNIQUE (section, key, language);

-- RLS policies
DROP POLICY IF EXISTS "Public can read homepage content" ON homepage_content;
CREATE POLICY "Public can read homepage content"
  ON homepage_content FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can write homepage content" ON homepage_content;
CREATE POLICY "Authenticated can write homepage content"
  ON homepage_content FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update homepage content" ON homepage_content;
CREATE POLICY "Authenticated can update homepage content"
  ON homepage_content FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete homepage content" ON homepage_content;
CREATE POLICY "Authenticated can delete homepage content"
  ON homepage_content FOR DELETE
  TO authenticated
  USING (true);

-- Seed default hero image_url for 'en' so storefront is not blank
INSERT INTO homepage_content (section, key, value, language, updated_at)
VALUES
  ('hero', 'media_type',    'image',                                                                                                                          'en', now()),
  ('hero', 'image_url',     'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=1600',                           'en', now()),
  ('hero', 'video_url',     '',                                                                                                                               'en', now()),
  ('hero', 'badge_text',    'PROFESSIONAL GRADE',                                                                                                             'en', now()),
  ('hero', 'title',         'Tested in Real Skydives',                                                                                                        'en', now()),
  ('hero', 'subtitle',      'Gear trusted by 10,000+ skydivers worldwide',                                                                                    'en', now()),
  ('hero', 'cta_primary',   'Shop Now',                                                                                                                       'en', now()),
  ('hero', 'cta_secondary', 'View Featured',                                                                                                                  'en', now()),
  ('hero', 'overlay_color', 'rgba(5,10,20,0.55)',                                                                                                             'en', now())
ON CONFLICT (section, key, language) DO NOTHING;
