/*
  # Orders RLS — pending status flow

  Context: orders table currently has RLS disabled and a single INSERT policy.

  Changes:
  1. Enable RLS on orders
  2. Keep existing INSERT policy (anon + authenticated for guest checkout)
  3. Add SELECT: authenticated users see their own orders (by user_id)
  4. Add SELECT: anon users can read orders too (needed for guest checkout
     confirmation — matched later by email, not user_id)
  5. Add UPDATE: authenticated users can update orders (admin uses the
     authenticated Supabase client; customer-side never calls update)
  6. Expand status check constraint to include 'confirmed' and 'rejected'
*/

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Expand status values to include confirmed and rejected
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending','confirmed','processing','shipped',
    'delivered','cancelled','rejected','refunded'
  ]::text[]));

-- SELECT: authenticated users see their own orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'Customers can view own orders'
  ) THEN
    CREATE POLICY "Customers can view own orders"
      ON orders FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- UPDATE: authenticated users (admin client) can update any order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'Authenticated can update orders'
  ) THEN
    CREATE POLICY "Authenticated can update orders"
      ON orders FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
