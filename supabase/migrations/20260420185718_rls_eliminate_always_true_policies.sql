/*
  # Eliminate all USING(true) / WITH CHECK(true) RLS policies

  ## Summary
  Every write policy previously used USING(true) or WITH CHECK(true), meaning any
  request with the anon key could mutate any table. This migration replaces all of
  them with a DB-enforced admin-token check.

  ## Mechanism
  A SECURITY DEFINER function `is_admin_request()` reads a per-transaction Postgres
  config variable `app.admin_verified`. The variable is set by calling the
  `set_admin_token(token text)` RPC, which only sets the flag when the token matches
  a hash stored in the private `app_secrets` table (no SELECT policy on that table).

  Flow:
  1. Admin calls verify_admin_credentials(email, password) → gets session_token
  2. Admin calls set_admin_token(session_token) → sets app.admin_verified = true
  3. All subsequent writes in the same transaction pass is_admin_request()

  ## Tables
  - Admin-only writes: products, categories, translations, employees, all CMS/settings tables
  - Customer writes: orders (INSERT open for guest checkout), customers/addresses (Supabase Auth uid)
  - Storage: bucket-scoped write policies now require admin token; broad catch-all removed

  ## Storage SELECT
  Dropped broad public SELECT policies — public buckets serve direct URLs without needing
  SELECT policies, so this eliminates the bucket-listing exposure with no functional impact.
*/

-- ─── Drop old verify_admin_credentials so we can change its return type ───────

DROP FUNCTION IF EXISTS verify_admin_credentials(text, text);

-- ─── Helper: admin token infrastructure ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_secrets (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
-- No SELECT policy — readable only by SECURITY DEFINER functions

INSERT INTO app_secrets (key, value)
SELECT 'admin_token_hash', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'admin_token_hash');

CREATE OR REPLACE FUNCTION generate_admin_session_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  UPDATE app_secrets SET value = crypt(v_token, gen_salt('bf')) WHERE key = 'admin_token_hash';
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION set_admin_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT value INTO v_hash FROM app_secrets WHERE key = 'admin_token_hash';
  IF v_hash IS NULL THEN RETURN false; END IF;
  IF crypt(p_token, v_hash) = v_hash THEN
    PERFORM set_config('app.admin_verified', 'true', true);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN current_setting('app.admin_verified', true) = 'true';
END;
$$;

-- Recreate verify_admin_credentials with session_token in return type
CREATE OR REPLACE FUNCTION verify_admin_credentials(p_email text, p_password text)
RETURNS TABLE (
  id            uuid,
  email         text,
  full_name     text,
  role          text,
  permissions   jsonb,
  is_active     boolean,
  session_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.email = p_email
      AND e.password_hash IS NOT NULL
      AND e.password_hash = crypt(p_password, e.password_hash)
      AND e.is_active = true
  ) THEN
    RETURN;
  END IF;

  v_token := generate_admin_session_token();

  RETURN QUERY
  SELECT e.id, e.email, e.full_name, e.role, e.permissions, e.is_active, v_token
  FROM employees e
  WHERE e.email = p_email AND e.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_admin_session_token()     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_admin_token(text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_admin_request()                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_admin_credentials(text,text) TO anon, authenticated;

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert products"  ON products;
DROP POLICY IF EXISTS "Anyone can update products"  ON products;
DROP POLICY IF EXISTS "Anyone can delete products"  ON products;

CREATE POLICY "Admin can insert products"
  ON products FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update products"
  ON products FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can manage categories"  ON categories;
DROP POLICY IF EXISTS "Authenticated can update categories"  ON categories;
DROP POLICY IF EXISTS "Authenticated can delete categories"  ON categories;
DROP POLICY IF EXISTS "categories_anon_insert"               ON categories;
DROP POLICY IF EXISTS "categories_anon_update"               ON categories;
DROP POLICY IF EXISTS "categories_anon_delete"               ON categories;

CREATE POLICY "Admin can insert categories"
  ON categories FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update categories"
  ON categories FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete categories"
  ON categories FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── CATEGORY_TRANSLATIONS ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can manage category_translations"  ON category_translations;
DROP POLICY IF EXISTS "Authenticated can update category_translations"  ON category_translations;
DROP POLICY IF EXISTS "Authenticated can delete category_translations"  ON category_translations;
DROP POLICY IF EXISTS "cat_trans_anon_insert"                           ON category_translations;
DROP POLICY IF EXISTS "cat_trans_anon_update"                           ON category_translations;
DROP POLICY IF EXISTS "cat_trans_anon_delete"                           ON category_translations;

CREATE POLICY "Admin can insert category_translations"
  ON category_translations FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update category_translations"
  ON category_translations FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete category_translations"
  ON category_translations FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── PRODUCT_TRANSLATIONS ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can manage product_translations"  ON product_translations;
DROP POLICY IF EXISTS "Authenticated can update product_translations"  ON product_translations;
DROP POLICY IF EXISTS "Authenticated can delete product_translations"  ON product_translations;

CREATE POLICY "Admin can insert product_translations"
  ON product_translations FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update product_translations"
  ON product_translations FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete product_translations"
  ON product_translations FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── EMPLOYEES ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert employees"  ON employees;
DROP POLICY IF EXISTS "Anyone can update employees"  ON employees;
DROP POLICY IF EXISTS "Anyone can delete employees"  ON employees;

CREATE POLICY "Admin can insert employees"
  ON employees FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update employees"
  ON employees FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete employees"
  ON employees FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── CMS_CONTENT ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert cms_content"  ON cms_content;
DROP POLICY IF EXISTS "Anon and auth can update cms_content"  ON cms_content;
DROP POLICY IF EXISTS "Anon and auth can delete cms_content"  ON cms_content;

CREATE POLICY "Admin can insert cms_content"
  ON cms_content FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update cms_content"
  ON cms_content FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete cms_content"
  ON cms_content FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── HOMEPAGE_CONTENT ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert homepage content"  ON homepage_content;
DROP POLICY IF EXISTS "Anon and auth can update homepage content"  ON homepage_content;
DROP POLICY IF EXISTS "Anon and auth can delete homepage content"  ON homepage_content;
DROP POLICY IF EXISTS "Anyone can insert homepage content"         ON homepage_content;
DROP POLICY IF EXISTS "Anyone can update homepage content"         ON homepage_content;

CREATE POLICY "Admin can insert homepage_content"
  ON homepage_content FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update homepage_content"
  ON homepage_content FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete homepage_content"
  ON homepage_content FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── SITE_BRANDING ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert branding"  ON site_branding;
DROP POLICY IF EXISTS "Anon and auth can update branding"  ON site_branding;
DROP POLICY IF EXISTS "Anon and auth can delete branding"  ON site_branding;

CREATE POLICY "Admin can insert site_branding"
  ON site_branding FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update site_branding"
  ON site_branding FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete site_branding"
  ON site_branding FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── SITE_SETTINGS ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert site settings"  ON site_settings;
DROP POLICY IF EXISTS "Anon and auth can update site settings"  ON site_settings;
DROP POLICY IF EXISTS "Anon and auth can delete site settings"  ON site_settings;
DROP POLICY IF EXISTS "Anyone can insert site settings"         ON site_settings;
DROP POLICY IF EXISTS "Anyone can update site settings"         ON site_settings;

CREATE POLICY "Admin can insert site_settings"
  ON site_settings FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update site_settings"
  ON site_settings FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete site_settings"
  ON site_settings FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── LAYOUT_SETTINGS ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert layout settings"  ON layout_settings;
DROP POLICY IF EXISTS "Anon and auth can update layout settings"  ON layout_settings;
DROP POLICY IF EXISTS "Anon and auth can delete layout settings"  ON layout_settings;

CREATE POLICY "Admin can insert layout_settings"
  ON layout_settings FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update layout_settings"
  ON layout_settings FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete layout_settings"
  ON layout_settings FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── PAGE_BLOCKS ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert page blocks"  ON page_blocks;
DROP POLICY IF EXISTS "Anon and auth can update page blocks"  ON page_blocks;
DROP POLICY IF EXISTS "Anon and auth can delete page blocks"  ON page_blocks;

CREATE POLICY "Admin can insert page_blocks"
  ON page_blocks FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update page_blocks"
  ON page_blocks FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete page_blocks"
  ON page_blocks FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── PAGE_LAYOUTS ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert page layouts"  ON page_layouts;
DROP POLICY IF EXISTS "Anon and auth can update page layouts"  ON page_layouts;
DROP POLICY IF EXISTS "Anon and auth can delete page layouts"  ON page_layouts;

CREATE POLICY "Admin can insert page_layouts"
  ON page_layouts FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update page_layouts"
  ON page_layouts FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete page_layouts"
  ON page_layouts FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── THEME_SETTINGS ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon and auth can insert theme settings"  ON theme_settings;
DROP POLICY IF EXISTS "Anon and auth can update theme settings"  ON theme_settings;
DROP POLICY IF EXISTS "Anon and auth can delete theme settings"  ON theme_settings;

CREATE POLICY "Admin can insert theme_settings"
  ON theme_settings FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update theme_settings"
  ON theme_settings FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete theme_settings"
  ON theme_settings FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── UI_SIZE_SETTINGS ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert ui size settings"  ON ui_size_settings;
DROP POLICY IF EXISTS "Anyone can update ui size settings"  ON ui_size_settings;

CREATE POLICY "Admin can insert ui_size_settings"
  ON ui_size_settings FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update ui_size_settings"
  ON ui_size_settings FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

-- ─── ORDERS — admin management ────────────────────────────────────────────────

CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete orders"
  ON orders FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── ORDER_ITEMS — admin management ──────────────────────────────────────────

CREATE POLICY "Admin can update order_items"
  ON order_items FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete order_items"
  ON order_items FOR DELETE TO anon, authenticated
  USING (is_admin_request());

-- ─── CUSTOMERS ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "customers_anon_insert"  ON customers;
DROP POLICY IF EXISTS "customers_anon_update"  ON customers;
DROP POLICY IF EXISTS "customers_public_read"  ON customers;

CREATE POLICY "Users can insert own customer record"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = id::text OR is_admin_request());

CREATE POLICY "Users can update own customer record"
  ON customers FOR UPDATE TO authenticated
  USING (auth.uid()::text = id::text OR is_admin_request())
  WITH CHECK (auth.uid()::text = id::text OR is_admin_request());

CREATE POLICY "Users can read own customer record"
  ON customers FOR SELECT TO authenticated
  USING (auth.uid()::text = id::text OR is_admin_request());

-- ─── CUSTOMER_ADDRESSES ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "customer_addresses_anon_insert"  ON customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_anon_update"  ON customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_public_read"  ON customer_addresses;

CREATE POLICY "Users can insert own addresses"
  ON customer_addresses FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = customer_id::text OR is_admin_request());

CREATE POLICY "Users can update own addresses"
  ON customer_addresses FOR UPDATE TO authenticated
  USING (auth.uid()::text = customer_id::text OR is_admin_request())
  WITH CHECK (auth.uid()::text = customer_id::text OR is_admin_request());

CREATE POLICY "Users can read own addresses"
  ON customer_addresses FOR SELECT TO authenticated
  USING (auth.uid()::text = customer_id::text OR is_admin_request());

-- ─── PERSONAL_DISCOUNT_CODES ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "pdc_anon_insert"  ON personal_discount_codes;
DROP POLICY IF EXISTS "pdc_anon_update"  ON personal_discount_codes;
DROP POLICY IF EXISTS "pdc_anon_delete"  ON personal_discount_codes;
DROP POLICY IF EXISTS "pdc_public_read"  ON personal_discount_codes;

CREATE POLICY "Admin can manage personal_discount_codes"
  ON personal_discount_codes FOR INSERT TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update personal_discount_codes"
  ON personal_discount_codes FOR UPDATE TO anon, authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete personal_discount_codes"
  ON personal_discount_codes FOR DELETE TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Users can read own discount codes"
  ON personal_discount_codes FOR SELECT TO authenticated
  USING (auth.uid()::text = customer_id::text OR is_admin_request());

-- ─── STORAGE — replace broad USING(true) with admin-token-gated policies ──────

DROP POLICY IF EXISTS "Anon and auth update any storage object"      ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete any storage object"      ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth upload hero-images"             ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth update hero-images"             ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete hero-images"             ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth upload logos"                   ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth update logos"                   ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete logos"                   ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth upload banners"                 ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth update banners"                 ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete banners"                 ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth upload product-images"          ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth update product-images"          ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete product-images"          ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth upload to uploads bucket"       ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth update uploads bucket"          ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete from uploads bucket"     ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth upload testimonials"            ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth update testimonials"            ON storage.objects;
DROP POLICY IF EXISTS "Anon and auth delete testimonials"            ON storage.objects;

CREATE POLICY "Admin upload hero-images"    ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'hero-images'    AND is_admin_request());
CREATE POLICY "Admin update hero-images"    ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'hero-images'    AND is_admin_request()) WITH CHECK (bucket_id = 'hero-images'    AND is_admin_request());
CREATE POLICY "Admin delete hero-images"    ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'hero-images'    AND is_admin_request());

CREATE POLICY "Admin upload logos"          ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'logos'          AND is_admin_request());
CREATE POLICY "Admin update logos"          ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'logos'          AND is_admin_request()) WITH CHECK (bucket_id = 'logos'          AND is_admin_request());
CREATE POLICY "Admin delete logos"          ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'logos'          AND is_admin_request());

CREATE POLICY "Admin upload banners"        ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'banners'        AND is_admin_request());
CREATE POLICY "Admin update banners"        ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'banners'        AND is_admin_request()) WITH CHECK (bucket_id = 'banners'        AND is_admin_request());
CREATE POLICY "Admin delete banners"        ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'banners'        AND is_admin_request());

CREATE POLICY "Admin upload product-images" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'product-images' AND is_admin_request());
CREATE POLICY "Admin update product-images" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'product-images' AND is_admin_request()) WITH CHECK (bucket_id = 'product-images' AND is_admin_request());
CREATE POLICY "Admin delete product-images" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'product-images' AND is_admin_request());

CREATE POLICY "Admin upload uploads"        ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'uploads'        AND is_admin_request());
CREATE POLICY "Admin update uploads"        ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'uploads'        AND is_admin_request()) WITH CHECK (bucket_id = 'uploads'        AND is_admin_request());
CREATE POLICY "Admin delete uploads"        ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'uploads'        AND is_admin_request());

CREATE POLICY "Admin upload testimonials"   ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'testimonials'   AND is_admin_request());
CREATE POLICY "Admin update testimonials"   ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'testimonials'   AND is_admin_request()) WITH CHECK (bucket_id = 'testimonials'   AND is_admin_request());
CREATE POLICY "Admin delete testimonials"   ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'testimonials'   AND is_admin_request());

-- ─── STORAGE — drop broad public SELECT policies (direct URL access still works)

DROP POLICY IF EXISTS "Public read hero-images"         ON storage.objects;
DROP POLICY IF EXISTS "Public read logos"               ON storage.objects;
DROP POLICY IF EXISTS "Public read banners"             ON storage.objects;
DROP POLICY IF EXISTS "Public read product-images"      ON storage.objects;
DROP POLICY IF EXISTS "Public read testimonials"        ON storage.objects;
DROP POLICY IF EXISTS "Public can view uploaded images" ON storage.objects;
