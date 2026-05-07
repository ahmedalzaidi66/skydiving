/*
  # Fix page_layouts RLS policies

  ## Problem
  page_layouts has RLS enabled but zero policies, so any INSERT/UPDATE/DELETE
  from the client is silently blocked. The "Create Default Layout" flow fails
  because the layout row cannot be inserted.

  ## Changes
  - Add SELECT policy (public read — matches page_blocks behavior)
  - Add INSERT policy for authenticated users
  - Add UPDATE policy for authenticated users
  - Add DELETE policy for authenticated users
*/

CREATE POLICY "Public can read page layouts"
  ON page_layouts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert page layouts"
  ON page_layouts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update page layouts"
  ON page_layouts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete page layouts"
  ON page_layouts FOR DELETE
  TO authenticated
  USING (true);
