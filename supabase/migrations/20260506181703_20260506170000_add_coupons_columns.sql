/*
  # Add missing columns to coupons table

  The coupons table was created as a bare scaffold with only id and created_at.
  This migration adds all business-logic columns needed by the admin UI.

  ## New columns
  - `code` — unique coupon code string (e.g. "WELCOME10")
  - `discount_type` — 'percentage' or 'fixed'
  - `discount_value` — numeric amount (e.g. 10 = 10% or $10)
  - `min_order_value` — minimum cart total to use this coupon
  - `expiry_date` — optional date after which coupon is invalid
  - `is_active` — whether the coupon can be used
  - `usage_count` — how many times it has been applied
  - `max_uses` — optional cap on total uses
  - `updated_at` — last modification timestamp

  No tables are dropped or recreated.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='code') THEN
    ALTER TABLE coupons ADD COLUMN code text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Make code unique after adding (safe because table is empty)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'coupons'::regclass AND conname = 'coupons_code_key'
  ) THEN
    ALTER TABLE coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='discount_type') THEN
    ALTER TABLE coupons ADD COLUMN discount_type text NOT NULL DEFAULT 'percentage';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='coupons' AND constraint_name='coupons_discount_type_check'
  ) THEN
    ALTER TABLE coupons ADD CONSTRAINT coupons_discount_type_check CHECK (discount_type IN ('percentage', 'fixed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='discount_value') THEN
    ALTER TABLE coupons ADD COLUMN discount_value numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='min_order_value') THEN
    ALTER TABLE coupons ADD COLUMN min_order_value numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='expiry_date') THEN
    ALTER TABLE coupons ADD COLUMN expiry_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='is_active') THEN
    ALTER TABLE coupons ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='usage_count') THEN
    ALTER TABLE coupons ADD COLUMN usage_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='max_uses') THEN
    ALTER TABLE coupons ADD COLUMN max_uses integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='updated_at') THEN
    ALTER TABLE coupons ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view coupons" ON coupons;
CREATE POLICY "Admins can view coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert coupons" ON coupons;
CREATE POLICY "Admins can insert coupons"
  ON coupons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update coupons" ON coupons;
CREATE POLICY "Admins can update coupons"
  ON coupons FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete coupons" ON coupons;
CREATE POLICY "Admins can delete coupons"
  ON coupons FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
