/*
  # Rebuild notifications table with full schema

  ## Summary
  The existing `notifications` table only had `id` and `created_at`.
  Adds columns needed for the notification center: user inbox, real-time
  badge, mark-as-read, and typed notification categories.

  ## Columns added to `notifications`
  - `user_id`   uuid FK → auth.users
  - `type`      text (order_update | gear_approved | gear_rejected | price_drop | announcement | report_update | campaign)
  - `title`     text
  - `message`   text
  - `read`      boolean DEFAULT false
  - `link`      text nullable
  - `metadata`  jsonb nullable

  ## Security
  - RLS enabled; users read/update own rows; admin inserts/deletes
*/

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, read)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can read own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Admin can insert notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (is_admin_request())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Admin can delete notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can delete notifications" ON notifications FOR DELETE TO authenticated USING (is_admin_request())';
  END IF;
END $$;
