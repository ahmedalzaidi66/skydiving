/*
  # Add key/value columns to site_settings

  The site_settings table was created with only id and created_at columns.
  The app's fetchThemeSettings() queries it with .like('key', 'theme_%'),
  and admin settings save to it with key/value pairs. Without these columns
  every read returns an error and theme always falls back to 'dark'.

  Changes:
  - Add `key` text UNIQUE NOT NULL column
  - Add `value` text NOT NULL DEFAULT '' column
  - Add `updated_at` timestamptz column
  - Enable RLS
  - Public read policy (theme must be readable by all visitors)
  - Admin write policy (only admin token holders can upsert)
*/

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS value text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Make key unique and non-null (safe — table was empty)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'site_settings' AND constraint_name = 'site_settings_key_key'
  ) THEN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_key_key UNIQUE (key);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'key'
    AND is_nullable = 'YES'
  ) THEN
    -- Only set NOT NULL after ensuring no NULLs exist
    DELETE FROM site_settings WHERE key IS NULL;
    ALTER TABLE site_settings ALTER COLUMN key SET NOT NULL;
  END IF;
END $$;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings (theme must be visible to anonymous users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Anyone can read site settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can read site settings"
      ON site_settings FOR SELECT
      TO public
      USING (true)';
  END IF;
END $$;

-- Seed default theme preset so the query returns a row immediately
INSERT INTO site_settings (key, value, updated_at)
VALUES ('theme_active_preset', 'dark', now())
ON CONFLICT (key) DO NOTHING;
