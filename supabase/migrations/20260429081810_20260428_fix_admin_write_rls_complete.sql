/*
  # Fix admin write RLS — products, product_color_variants, storage

  ## Problem
  The admin uses a custom token-based auth (x-admin-token header) that does NOT
  create a Supabase Auth session. When adminSupabase() falls back to the bare
  anon client (token not yet in memory, or new client instance without headers
  for storage), is_admin_request() returns false and all writes are blocked.

  ## Fix
  Add authenticated-role fallback policies to every table and bucket that admin
  needs write access to. The original is_admin_request() policies remain intact
  for the pure-token path.

  ## Tables fixed
  - products: INSERT, UPDATE, DELETE for authenticated
  - product_color_variants: INSERT, UPDATE, DELETE for anon+authenticated with is_admin_request()
    (was service_role only — completely inaccessible to the admin JS client)

  ## Storage fixed
  - All remaining buckets (banners, hero-images, logos, testimonials) get
    authenticated-role INSERT/UPDATE/DELETE policies so the image uploader
    works regardless of auth path.
*/

-- ── products: authenticated fallback ─────────────────────────────────────────

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── product_color_variants: admin token + authenticated ───────────────────────
-- Previously only service_role could write — admin JS client was fully blocked.

CREATE POLICY "Admins can insert color variants"
  ON product_color_variants FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update color variants"
  ON product_color_variants FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete color variants"
  ON product_color_variants FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Authenticated users can insert color variants"
  ON product_color_variants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update color variants"
  ON product_color_variants FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete color variants"
  ON product_color_variants FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── storage: authenticated fallback for remaining buckets ─────────────────────

CREATE POLICY "Authenticated users can upload banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload hero-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update hero-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hero-images' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'hero-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete hero-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hero-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload testimonials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'testimonials' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update testimonials"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'testimonials' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'testimonials' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete testimonials"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'testimonials' AND auth.uid() IS NOT NULL);
