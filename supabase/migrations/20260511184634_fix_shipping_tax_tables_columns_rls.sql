/*
  # Fix Shipping & Tax Tables — Columns, RLS, Triggers

  ## Root Causes Fixed
  1. shipping_rules table existed but was missing all business columns (name, scope,
     region, shipping_type, value, free_threshold, is_enabled, updated_at) because the
     original CREATE TABLE IF NOT EXISTS was skipped (empty table already existed).
  2. tax_rules table was entirely missing.
  3. No RLS policies existed on either table.

  ## Changes

  ### shipping_rules
  - Adds all missing columns idempotently via DO block
  - Adds CHECK constraints for scope and shipping_type
  - Enables RLS
  - Creates SELECT (public), INSERT/UPDATE/DELETE (authenticated) policies

  ### tax_rules
  - Creates table if missing with all columns
  - Enables RLS
  - Creates SELECT (public), INSERT/UPDATE/DELETE (authenticated) policies

  ### Triggers
  - set_updated_at() function for both tables (SECURITY INVOKER)

  ### orders table
  - Adds tax and shipping columns if missing
*/

-- ── 1. shipping_rules: add missing columns ────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='name') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='scope') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN scope text NOT NULL DEFAULT 'country';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='region') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN region text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='shipping_type') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN shipping_type text NOT NULL DEFAULT 'fixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='value') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN value numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='free_threshold') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN free_threshold numeric(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='is_enabled') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_rules' AND column_name='updated_at') THEN
    ALTER TABLE public.shipping_rules ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- CHECK constraints (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'shipping_rules' AND constraint_name = 'shipping_rules_scope_check'
  ) THEN
    ALTER TABLE public.shipping_rules
      ADD CONSTRAINT shipping_rules_scope_check CHECK (scope IN ('continent','country'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'shipping_rules' AND constraint_name = 'shipping_rules_type_check'
  ) THEN
    ALTER TABLE public.shipping_rules
      ADD CONSTRAINT shipping_rules_type_check CHECK (shipping_type IN ('fixed','percentage','free'));
  END IF;
END $$;

-- RLS
ALTER TABLE public.shipping_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read enabled shipping rules" ON public.shipping_rules;
DROP POLICY IF EXISTS "Anyone can read shipping rules"        ON public.shipping_rules;
DROP POLICY IF EXISTS "Admins can insert shipping rules"      ON public.shipping_rules;
DROP POLICY IF EXISTS "Admins can update shipping rules"      ON public.shipping_rules;
DROP POLICY IF EXISTS "Admins can delete shipping rules"      ON public.shipping_rules;

CREATE POLICY "Public read shipping rules"
  ON public.shipping_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated insert shipping rules"
  ON public.shipping_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update shipping rules"
  ON public.shipping_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete shipping rules"
  ON public.shipping_rules FOR DELETE
  TO authenticated
  USING (true);

-- ── 2. tax_rules ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tax_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country        text NOT NULL DEFAULT '',
  tax_percentage numeric(5,2) NOT NULL DEFAULT 0,
  tax_label      text NOT NULL DEFAULT 'Tax',
  is_enabled     boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tax rules"   ON public.tax_rules;
DROP POLICY IF EXISTS "Admins can insert tax rules"  ON public.tax_rules;
DROP POLICY IF EXISTS "Admins can update tax rules"  ON public.tax_rules;
DROP POLICY IF EXISTS "Admins can delete tax rules"  ON public.tax_rules;

CREATE POLICY "Public read tax rules"
  ON public.tax_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated insert tax rules"
  ON public.tax_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update tax rules"
  ON public.tax_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete tax rules"
  ON public.tax_rules FOR DELETE
  TO authenticated
  USING (true);

-- ── 3. updated_at trigger function ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipping_rules_updated_at ON public.shipping_rules;
CREATE TRIGGER trg_shipping_rules_updated_at
  BEFORE UPDATE ON public.shipping_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tax_rules_updated_at ON public.tax_rules;
CREATE TRIGGER trg_tax_rules_updated_at
  BEFORE UPDATE ON public.tax_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. orders: add tax + shipping columns if missing ─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tax'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN tax numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN shipping numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
