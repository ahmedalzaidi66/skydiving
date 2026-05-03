/*
  # Allow authenticated users to edit their own pending orders

  ## Summary
  Adds RLS policies so that a logged-in customer can:
  - Cancel (set status = 'cancelled') their own orders that are still 'pending'
  - Update quantities of order_items on their own pending orders
  - Delete (remove) order_items from their own pending orders
  - Recalculate order subtotal/total after item changes (handled by the app)

  ## New Policies

  ### orders
  - "Authenticated users can cancel own pending orders"
    UPDATE — only if status is currently 'pending' AND new status is 'cancelled'
    Also allows updating subtotal/shipping/total for recalculation after item removal

  ### order_items
  - "Authenticated users can update own pending order items"
    UPDATE — quantity changes on items belonging to own pending orders
  - "Authenticated users can delete own pending order items"
    DELETE — remove items from own pending orders

  ## Security
  - All policies check auth.uid() via auth.jwt() ->> 'email' matching customer_email
  - Cancellation is the only allowed status transition (pending → cancelled)
  - No other status transitions are permitted by this policy
*/

-- ── orders: allow cancel + totals recalc on own pending orders ────────────────

CREATE POLICY "Authenticated users can update own pending orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    customer_email = (auth.jwt() ->> 'email')
    AND status = 'pending'
  )
  WITH CHECK (
    customer_email = (auth.jwt() ->> 'email')
    AND status IN ('pending', 'cancelled')
  );

-- ── order_items: allow quantity updates on own pending orders ─────────────────

CREATE POLICY "Authenticated users can update own pending order items"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = (auth.jwt() ->> 'email')
        AND o.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = (auth.jwt() ->> 'email')
        AND o.status = 'pending'
    )
  );

-- ── order_items: allow deletion from own pending orders ───────────────────────

CREATE POLICY "Authenticated users can delete own pending order items"
  ON order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = (auth.jwt() ->> 'email')
        AND o.status = 'pending'
    )
  );
