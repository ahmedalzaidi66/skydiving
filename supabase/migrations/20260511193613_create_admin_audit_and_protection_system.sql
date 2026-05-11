/*
  # Admin Audit Logs & Real Route Protection

  ## Summary
  1. Creates `admin_audit_logs` table — immutable record of all admin actions.
  2. Creates `is_admin_session(p_token text)` function — verifies a raw session
     token against the bcrypt hash on the employee row. Used by RLS policies and
     the new audit RPC.
  3. Creates `insert_audit_log(...)` SECURITY DEFINER RPC — the only way to write
     audit rows; validates admin token before inserting.
  4. Creates `verify_admin_session(p_token text)` — returns employee/role info for
     a token; used by AdminGuard for real server-side session validation.
  5. Tightens admin-write RLS on products, coupons, orders, site_settings,
     employees to require a valid session token, not just any authenticated user.

  ## New Tables
  - `admin_audit_logs` — id, admin_user_id, admin_email, action, entity_type,
    entity_id, entity_label, old_values, new_values, ip_address, user_agent,
    created_at

  ## Security
  - RLS on audit_logs: authenticated admins SELECT only via is_admin_session.
  - No direct INSERT/UPDATE/DELETE on audit_logs; only via RPC.
  - pgcrypto required for bcrypt; enabled below if not already present.
*/

-- Enable pgcrypto for bcrypt support (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Helper: verify raw admin token against employee bcrypt hash ──────────────

CREATE OR REPLACE FUNCTION is_admin_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN false;
  END IF;

  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE crypt(p_token, session_token_hash) = session_token_hash
    AND is_active = true
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;

-- ─── Helper: reads x-admin-token from PostgREST request headers ──────────────
-- Used in RLS USING clauses. Safe fallback to false if no token.

CREATE OR REPLACE FUNCTION is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_headers text;
  v_token   text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true);
    v_token   := (v_headers::json)->>'x-admin-token';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN is_admin_session(v_token);
END;
$$;

-- ─── Verify admin session and return employee row ─────────────────────────────
-- Called by AdminGuard for real server-side protection (not just client state).

CREATE OR REPLACE FUNCTION verify_admin_session(p_token text)
RETURNS TABLE (
  employee_id    text,
  employee_email text,
  role_key       text,
  is_active      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      e.id::text,
      e.email,
      COALESCE(r.key, ''),
      e.is_active
    FROM employees e
    LEFT JOIN roles r ON r.id = e.role_id
    WHERE crypt(p_token, e.session_token_hash) = e.session_token_hash
      AND e.is_active = true
    LIMIT 1;
END;
$$;

-- ─── Issue session token ──────────────────────────────────────────────────────
-- Generates a new random token, stores its bcrypt hash on the employee row,
-- and returns the raw token to the caller.

CREATE OR REPLACE FUNCTION issue_admin_token_for_auth_user(p_auth_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_token text;
  v_hash      text;
  v_count     int;
BEGIN
  -- Check that a matching active employee row exists
  SELECT count(*) INTO v_count
  FROM employees
  WHERE auth_user_id = p_auth_user_id AND is_active = true;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No active employee record for auth user %', p_auth_user_id;
  END IF;

  -- Generate a random token (two UUIDs joined)
  v_raw_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_hash      := crypt(v_raw_token, gen_salt('bf', 8));

  UPDATE employees
  SET session_token_hash = v_hash, updated_at = now()
  WHERE auth_user_id = p_auth_user_id;

  RETURN v_raw_token;
END;
$$;

-- ─── Get employee permissions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_employee_permissions(p_email text)
RETURNS TABLE (permission_key text, role_key text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_custom jsonb;
  v_role_id bigint;
BEGIN
  SELECT e.custom_permissions, e.role_id
  INTO v_custom, v_role_id
  FROM employees e
  WHERE lower(e.email) = lower(p_email)
  LIMIT 1;

  -- Custom permissions override role defaults when set
  IF v_custom IS NOT NULL AND jsonb_array_length(v_custom) > 0 THEN
    RETURN QUERY
      SELECT p_elem::text, 'custom'::text
      FROM jsonb_array_elements_text(v_custom) AS p_elem;
  ELSE
    RETURN QUERY
      SELECT rp.permission_key, r.key
      FROM role_permissions rp
      JOIN roles r ON r.id = (
        SELECT role_id FROM employees WHERE lower(email) = lower(p_email) LIMIT 1
      )
      WHERE rp.role_key = r.key;
  END IF;
END;
$$;

-- ─── Update role permissions RPC ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_role_permissions(p_role_key text, p_permissions text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_request() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM role_permissions WHERE role_key = p_role_key;

  INSERT INTO role_permissions (role_key, permission_key)
  SELECT p_role_key, unnest(p_permissions);

  RETURN true;
END;
$$;

-- ─── Update employee custom permissions RPC ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_employee_permissions(p_email text, p_permissions text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_request() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE employees
  SET custom_permissions = to_jsonb(p_permissions), updated_at = now()
  WHERE lower(email) = lower(p_email);

  RETURN true;
END;
$$;

-- ─── Verify admin token (used by edge functions) ──────────────────────────────

CREATE OR REPLACE FUNCTION verify_admin_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN is_admin_session(p_token);
END;
$$;

-- ─── Audit Logs Table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text        NOT NULL,
  admin_email   text        NOT NULL,
  action        text        NOT NULL,
  entity_type   text        NOT NULL,
  entity_id     text,
  entity_label  text,
  old_values    jsonb,
  new_values    jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_idx      ON admin_audit_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx     ON admin_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx     ON admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs (created_at DESC);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (is_admin_request());

-- ─── Audit Log Insert RPC ─────────────────────────────────────────────────────
-- SECURITY DEFINER: validates admin token before any insert.
-- Direct row-level INSERT is blocked by RLS (no INSERT policy).

CREATE OR REPLACE FUNCTION insert_audit_log(
  p_admin_user_id text,
  p_admin_email   text,
  p_action        text,
  p_entity_type   text,
  p_entity_id     text    DEFAULT NULL,
  p_entity_label  text    DEFAULT NULL,
  p_old_values    jsonb   DEFAULT NULL,
  p_new_values    jsonb   DEFAULT NULL,
  p_ip_address    text    DEFAULT NULL,
  p_user_agent    text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token  text;
  v_new_id uuid;
BEGIN
  BEGIN
    v_token := (current_setting('request.headers', true)::json)->>'x-admin-token';
  EXCEPTION WHEN OTHERS THEN
    v_token := NULL;
  END;

  IF NOT is_admin_session(v_token) THEN
    RAISE EXCEPTION 'Unauthorized: invalid or missing admin token';
  END IF;

  INSERT INTO admin_audit_logs (
    admin_user_id, admin_email, action, entity_type, entity_id,
    entity_label, old_values, new_values, ip_address, user_agent
  ) VALUES (
    p_admin_user_id, p_admin_email, p_action, p_entity_type, p_entity_id,
    p_entity_label, p_old_values, p_new_values, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ─── Tighten RLS policies to require valid admin token ────────────────────────

-- Products: replace "true" admin write with real token check
DROP POLICY IF EXISTS "admin product write" ON products;
CREATE POLICY "admin product write"
  ON products FOR ALL
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- Coupons
DROP POLICY IF EXISTS "Admins can delete coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can insert coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can view coupons"   ON coupons;

CREATE POLICY "Admin can manage coupons"
  ON coupons FOR ALL
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- Public coupon lookup (storefront validates codes)
CREATE POLICY "Anyone can read active coupons"
  ON coupons FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Orders: tighten admin update (keep customer read + insert)
DROP POLICY IF EXISTS "Authenticated can update orders" ON orders;
CREATE POLICY "Admin can update any order"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    is_admin_request()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    is_admin_request()
    OR user_id = auth.uid()
  );

-- Site settings
DROP POLICY IF EXISTS "Admin can upsert site settings" ON site_settings;
CREATE POLICY "Admin can manage site settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- Employees: only admins may write
DROP POLICY IF EXISTS "Admin can manage employees" ON employees;
CREATE POLICY "Admin can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION is_admin_session(text)          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_admin_request()              TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_admin_session(text)      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION issue_admin_token_for_auth_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_admin_token(text)        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_employee_permissions(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION update_role_permissions(text, text[])     TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_permissions(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_audit_log(text,text,text,text,text,text,jsonb,jsonb,text,text) TO authenticated;
