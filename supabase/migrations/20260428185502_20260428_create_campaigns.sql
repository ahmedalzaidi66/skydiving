/*
  # Admin Notification Campaigns

  ## Summary
  Creates tables to store admin-created campaigns and their delivery history.
  Campaigns allow admins to send promotional messages to all customers or
  individual customers via in-app, email, or WhatsApp channels.

  ## New Tables
  - `campaigns`
    - `id` (uuid, PK)
    - `title` (text) — campaign headline
    - `message` (text) — body text
    - `product_link` (text, nullable) — optional deep-link
    - `offer_code` (text, nullable) — optional coupon code
    - `audience` (text) — 'all' | 'single'
    - `target_user_id` (uuid, nullable) — set when audience = 'single'
    - `channels` (text[]) — e.g. ['in_app', 'email', 'whatsapp']
    - `status` (text) — 'draft' | 'sent' | 'partial'
    - `sent_count` (int) — number of in-app notifications created
    - `created_by` (text) — admin name/email snapshot
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled; only service_role can insert/update (admin client)
  - Authenticated users can read (for audit/history if needed)
*/

CREATE TABLE IF NOT EXISTS campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL DEFAULT '',
  message        text NOT NULL DEFAULT '',
  product_link   text,
  offer_code     text,
  audience       text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','single')),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channels       text[] NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft','sent','partial')),
  sent_count     int NOT NULL DEFAULT 0,
  created_by     text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON campaigns(created_at DESC);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage campaigns"
  ON campaigns FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update campaigns"
  ON campaigns FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (true);
