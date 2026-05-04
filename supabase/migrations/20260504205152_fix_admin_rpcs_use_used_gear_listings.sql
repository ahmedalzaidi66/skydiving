/*
  # Fix admin RPCs to target used_gear_listings

  Both admin_update_listing_status and admin_verify_listing_seller were
  updating public.used_gears (non-existent/wrong table) instead of
  public.used_gear_listings. Drop and recreate both functions so approve,
  reject, and verify operations actually persist.

  Changes:
  - admin_update_listing_status: update used_gear_listings.status and admin_note, returns jsonb
  - admin_verify_listing_seller: update used_gear_listings.seller_verified
*/

DROP FUNCTION IF EXISTS public.admin_update_listing_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_verify_listing_seller(uuid, boolean);

CREATE FUNCTION public.admin_update_listing_status(
  p_listing_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

CREATE FUNCTION public.admin_verify_listing_seller(
  p_listing_id uuid,
  p_verified boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.used_gear_listings
  SET
    seller_verified = p_verified,
    updated_at      = now()
  WHERE id = p_listing_id;
END;
$$;
