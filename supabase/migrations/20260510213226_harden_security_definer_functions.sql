/*
  # Harden SECURITY DEFINER Function Exposure

  ## Problem
  Five SECURITY DEFINER functions and one regular function were executable by
  the `anon` role, meaning any unauthenticated visitor could call them directly.
  The two admin functions had no caller-identity check inside their body,
  allowing full privilege escalation: anyone could approve/reject listings,
  verify sellers, etc.

  ## Changes

  ### 1. admin_update_listing_status
  - Revoke EXECUTE from anon and public
  - Keep for authenticated + service_role only
  - Add is_admin_request() guard inside body — raises exception if caller is not admin

  ### 2. admin_verify_listing_seller
  - Same treatment as above

  ### 3. recalc_product_rating (trigger function)
  - Trigger functions are invoked by the trigger mechanism as the function owner,
    not by role EXECUTE privilege. The anon/authenticated grants are therefore
    unused and misleading.
  - Revoke from anon and authenticated; keep service_role
  - Keep SECURITY DEFINER (required to write to products table across RLS)

  ### 4. recalc_seller_rating (trigger function)
  - Same treatment as recalc_product_rating

  ### 5. update_used_gear_updated_at (trigger function)
  - Simple timestamp setter: no cross-table privilege needed
  - Convert to SECURITY INVOKER (the DML that fires the trigger already has
    the correct write access to the row being modified)
  - Revoke all direct-call grants

  ### 6. get_user_permissions
  - Non-admin helper that exposes employee role/permission mappings
  - Restrict to authenticated role only (anon has no legitimate use for it)
*/

-- ─── 1. admin_update_listing_status ─────────────────────────────────────────
-- Revoke broad grants
REVOKE EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) FROM authenticated;
-- Keep service_role
GRANT EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) TO service_role;

-- Re-create with internal auth guard
CREATE OR REPLACE FUNCTION public.admin_update_listing_status(
  p_listing_id uuid,
  p_status     text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify the caller holds a valid admin session token
  IF NOT public.is_admin_request() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.used_gear_listings
  SET
    status     = p_status,
    admin_note = COALESCE(p_admin_note, admin_note),
    updated_at = now()
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Listing not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant back to authenticated (admin is always authenticated; guard is inside body)
GRANT EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) TO authenticated;


-- ─── 2. admin_verify_listing_seller ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_verify_listing_seller(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_verify_listing_seller(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_verify_listing_seller(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_listing_seller(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_verify_listing_seller(
  p_listing_id uuid,
  p_verified   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.is_admin_request() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.used_gear_listings
  SET
    seller_verified = p_verified,
    updated_at      = now()
  WHERE id = p_listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_listing_seller(uuid, boolean) TO authenticated;


-- ─── 3. recalc_product_rating (trigger — revoke direct-call access) ─────────
-- Trigger functions are fired by the trigger engine, not by role EXECUTE.
-- These grants are unused and create unnecessary attack surface.
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating() FROM authenticated;
-- service_role retains access (needed for admin-initiated review operations)
GRANT EXECUTE ON FUNCTION public.recalc_product_rating() TO service_role;


-- ─── 4. recalc_seller_rating (trigger — same treatment) ─────────────────────
REVOKE EXECUTE ON FUNCTION public.recalc_seller_rating() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_seller_rating() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalc_seller_rating() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_seller_rating() TO service_role;


-- ─── 5. update_used_gear_updated_at — convert to SECURITY INVOKER ───────────
-- This function only sets NEW.updated_at = now(). It needs no elevated privilege;
-- the caller already has UPDATE permission on the row (enforced by RLS on the table).
-- SECURITY INVOKER is strictly safer here.
CREATE OR REPLACE FUNCTION public.update_used_gear_updated_at()
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

REVOKE EXECUTE ON FUNCTION public.update_used_gear_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_used_gear_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_used_gear_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_used_gear_updated_at() TO service_role;


-- ─── 6. get_user_permissions — restrict to authenticated ────────────────────
-- Exposes employee → role → permission mappings. No anon use case exists.
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO service_role;
