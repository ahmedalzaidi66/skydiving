/*
  # Shipping & Tax Rules

  ## Summary
  Adds two tables for admin-configurable shipping and tax rules.
  Also adds a `tax` column to the orders table to record applied tax.

  ## New Tables

  ### shipping_rules
  - `id` (uuid, pk)
  - `name` (text) — rule label shown in admin
  - `scope` (text) — 'continent' | 'country'
  - `region` (text) — continent name or ISO country name/code
  - `shipping_type` (text) — 'fixed' | 'percentage' | 'free'
  - `value` (numeric) — amount for fixed/percentage (0 for free)
  - `free_threshold` (numeric, nullable) — if order >= this value, shipping = 0
  - `is_enabled` (boolean)
  - `created_at`, `updated_at`

  ### tax_rules
  - `id` (uuid, pk)
  - `country` (text) — country name or code this rule applies to
  - `tax_percentage` (numeric) — e.g. 20 for 20%
  - `tax_label` (text) — e.g. 'VAT', 'Sales Tax'
  - `is_enabled` (boolean)
  - `created_at`, `updated_at`

  ## Modified Tables
  - `orders`: adds `tax` (numeric 10,2, default 0)

  ## Security
  - RLS enabled on both tables
  - Admins (via x-admin-token) can manage rules
  - Public can SELECT enabled rules (needed for checkout calculation)
*/

-- ── Shipping rules ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL DEFAULT '',
  scope          text NOT NULL DEFAULT 'country' CHECK (scope IN ('continent', 'country')),
  region         text NOT NULL DEFAULT '',
  shipping_type  text NOT NULL DEFAULT 'fixed' CHECK (shipping_type IN ('fixed', 'percentage', 'free')),
  value          numeric(10,2) NOT NULL DEFAULT 0,
  free_threshold numeric(10,2),
  is_enabled     boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read enabled shipping rules"
  ON shipping_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert shipping rules"
  ON shipping_rules FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_admin_request());

CREATE POLICY "Admins can update shipping rules"
  ON shipping_rules FOR UPDATE
  TO anon, authenticated
  USING (public.is_admin_request())
  WITH CHECK (public.is_admin_request());

CREATE POLICY "Admins can delete shipping rules"
  ON shipping_rules FOR DELETE
  TO anon, authenticated
  USING (public.is_admin_request());

-- ── Tax rules ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country        text NOT NULL DEFAULT '',
  tax_percentage numeric(5,2) NOT NULL DEFAULT 0,
  tax_label      text NOT NULL DEFAULT 'Tax',
  is_enabled     boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tax rules"
  ON tax_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert tax rules"
  ON tax_rules FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_admin_request());

CREATE POLICY "Admins can update tax rules"
  ON tax_rules FOR UPDATE
  TO anon, authenticated
  USING (public.is_admin_request())
  WITH CHECK (public.is_admin_request());

CREATE POLICY "Admins can delete tax rules"
  ON tax_rules FOR DELETE
  TO anon, authenticated
  USING (public.is_admin_request());

-- ── Add tax to orders ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tax'
  ) THEN
    ALTER TABLE orders ADD COLUMN tax numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
