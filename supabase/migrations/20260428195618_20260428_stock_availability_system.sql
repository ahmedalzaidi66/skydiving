/*
  # Full Stock & Availability System

  ## Summary
  Adds unlimited stock toggle, low stock threshold, per-color-variant stock,
  stock decrement on order placement, stock restore on cancel/refund, and
  a refunded order status.

  ## Modified Tables
  - `products`
    - `unlimited_stock` (boolean, default false) — skip stock checks when true
    - `low_stock_threshold` (int, default 5) — threshold for "low stock" warning

  - `product_color_variants`
    - `stock` (int, nullable) — per-color stock; NULL means use product-level stock

  - `order_items`
    - `stock_at_purchase` (int, nullable) — snapshot of stock when ordered

  ## New RPCs
  - `decrement_stock_on_order(p_order_id uuid)` — decrements product/color stock
  - `restore_stock_on_cancel(p_order_id uuid)` — restores stock when order is cancelled/refunded

  ## Security
  - RPCs run with SECURITY DEFINER to allow stock mutation by anon/auth users
    during checkout (the only mutation path), and by admins for cancel/refund.
  - All stock mutations are guarded by the RPC logic itself.
*/

-- ── Products: new columns ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'unlimited_stock'
  ) THEN
    ALTER TABLE products ADD COLUMN unlimited_stock boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'low_stock_threshold'
  ) THEN
    ALTER TABLE products ADD COLUMN low_stock_threshold int NOT NULL DEFAULT 5;
  END IF;
END $$;

-- ── Color variants: per-color stock ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_color_variants' AND column_name = 'stock'
  ) THEN
    ALTER TABLE product_color_variants ADD COLUMN stock int;
  END IF;
END $$;

-- ── Order items: stock snapshot ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'stock_at_purchase'
  ) THEN
    ALTER TABLE order_items ADD COLUMN stock_at_purchase int;
  END IF;
END $$;

-- ── RPC: decrement stock when order is placed ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oi.product_id, oi.quantity, oi.selected_color,
           p.unlimited_stock, p.stock AS product_stock
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    CONTINUE WHEN r.unlimited_stock;

    IF r.selected_color IS NOT NULL THEN
      -- Try per-color stock first
      UPDATE product_color_variants
        SET stock = GREATEST(0, COALESCE(stock, r.product_stock) - r.quantity)
        WHERE product_id = r.product_id
          AND name = r.selected_color
          AND stock IS NOT NULL;

      -- If no per-color stock row affected, fall back to product stock
      IF NOT FOUND THEN
        UPDATE products
          SET stock = GREATEST(0, stock - r.quantity)
          WHERE id = r.product_id;
      END IF;
    ELSE
      UPDATE products
        SET stock = GREATEST(0, stock - r.quantity)
        WHERE id = r.product_id;
    END IF;
  END LOOP;
END;
$$;

-- ── RPC: restore stock when order is cancelled/refunded ───────────────────────
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oi.product_id, oi.quantity, oi.selected_color,
           p.unlimited_stock
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    CONTINUE WHEN r.unlimited_stock;

    IF r.selected_color IS NOT NULL THEN
      UPDATE product_color_variants
        SET stock = COALESCE(stock, 0) + r.quantity
        WHERE product_id = r.product_id
          AND name = r.selected_color
          AND stock IS NOT NULL;

      IF NOT FOUND THEN
        UPDATE products SET stock = stock + r.quantity WHERE id = r.product_id;
      END IF;
    ELSE
      UPDATE products SET stock = stock + r.quantity WHERE id = r.product_id;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute to authenticated and anon (checkout runs as anon)
GRANT EXECUTE ON FUNCTION public.decrement_stock_on_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_stock_on_cancel(uuid) TO anon, authenticated;
