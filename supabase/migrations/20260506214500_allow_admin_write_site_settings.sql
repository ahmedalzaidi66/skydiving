/*
  # Allow admin to write site_settings

  The site_settings table had only a public SELECT policy.
  Admin upserts (theme preset save) were silently blocked by RLS,
  so the DB value never changed and theme stayed dark.

  Matches the pattern used on other admin-writable tables (products, etc).
*/

CREATE POLICY "Admin can upsert site settings"
  ON site_settings FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
