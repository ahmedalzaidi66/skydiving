/*
  # Fix is_admin_request() — employees SELECT RLS deadlock

  Root cause:
    is_admin_request() queries the `employees` table to validate the token.
    The `employees` SELECT policy itself calls is_admin_request(), creating a
    recursive deadlock.  When the caller is `anon` (no JWT), the inner SELECT
    on employees returns 0 rows → is_admin_request() returns false → Unauthorized.

  Fix:
    Recreate is_admin_request() as SECURITY DEFINER so the inner SELECT on
    `employees` runs as the function owner (postgres/service role) and bypasses
    RLS entirely, breaking the recursion.

  No schema or data changes.  Only the function security model changes.
*/

CREATE OR REPLACE FUNCTION public.is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_raw    text;
  v_headers json;
  v_token   text;
  v_hash    text;
BEGIN
  v_raw := current_setting('request.headers', true);

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_headers := v_raw::json;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  v_token := v_headers->>'x-admin-token';
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;

  -- This SELECT now runs as the function owner (bypasses employees RLS)
  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE session_token_hash IS NOT NULL
    AND is_active = true
    AND crypt(v_token, session_token_hash) = session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;
