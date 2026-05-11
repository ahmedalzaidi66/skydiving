/*
  # Fix is_admin_session search_path — pgcrypto crypt() resolution

  ## Problem
  `is_admin_session()` was defined with `SET search_path = public` only.
  pgcrypto's `crypt()` function lives in the `extensions` schema, so the
  bcrypt comparison always throws "function crypt() does not exist", causing
  every admin token validation to fail with an obscure error that surfaces as
  "function public.is_admin_request() does not exist" at the RPC layer.

  ## Fix
  Recreate `is_admin_session()` with `SET search_path = public, extensions`
  so `crypt()` resolves correctly. Inline the bcrypt check (no sub-call) for
  maximum reliability.

  Also recreate `is_admin_request()` with the same search_path to be safe.

  No schema or data changes.
*/

-- ─── Fix is_admin_session: add extensions to search_path ─────────────────────

CREATE OR REPLACE FUNCTION public.is_admin_session(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN false;
  END IF;

  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE session_token_hash IS NOT NULL
    AND is_active = true
    AND crypt(p_token, session_token_hash) = session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;

-- ─── Fix is_admin_request: inline check, correct search_path ─────────────────

CREATE OR REPLACE FUNCTION public.is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_raw     text;
  v_token   text;
  v_hash    text;
BEGIN
  v_raw := current_setting('request.headers', true);

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_token := (v_raw::json)->>'x-admin-token';
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;

  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE session_token_hash IS NOT NULL
    AND is_active = true
    AND crypt(v_token, session_token_hash) = session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;

-- ─── Fix verify_admin_session: same search_path fix ───────────────────────────

CREATE OR REPLACE FUNCTION public.verify_admin_session(p_token text)
RETURNS TABLE (
  employee_id    text,
  employee_email text,
  role_key       text,
  is_active      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
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
    WHERE e.session_token_hash IS NOT NULL
      AND e.is_active = true
      AND crypt(p_token, e.session_token_hash) = e.session_token_hash
    LIMIT 1;
END;
$$;

-- ─── Fix issue_admin_token_for_auth_user: same search_path fix ───────────────

CREATE OR REPLACE FUNCTION public.issue_admin_token_for_auth_user(p_auth_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_raw_token text;
  v_hash      text;
  v_count     int;
BEGIN
  SELECT count(*) INTO v_count
  FROM employees
  WHERE auth_user_id = p_auth_user_id AND is_active = true;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No active employee record for auth user %', p_auth_user_id;
  END IF;

  v_raw_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_hash      := crypt(v_raw_token, gen_salt('bf', 8));

  UPDATE employees
  SET session_token_hash = v_hash, updated_at = now()
  WHERE auth_user_id = p_auth_user_id;

  RETURN v_raw_token;
END;
$$;

-- ─── Re-grant (idempotent) ────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.is_admin_session(text)          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_request()              TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_session(text)      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.issue_admin_token_for_auth_user(uuid) TO authenticated;
