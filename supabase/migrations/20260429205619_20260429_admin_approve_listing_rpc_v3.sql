/*
  # Fix admin_update_listing_status RPC — drop and recreate with json return type

  Changes:
  - Drop old void-returning function
  - Recreate returning json{ok, error} so callers can detect success vs failure
  - Grant EXECUTE to anon and authenticated (auth guard is inside the function body)
*/

DROP FUNCTION IF EXISTS public.admin_update_listing_status(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_update_listing_status(
  p_id         uuid,
  p_status     text,
  p_admin_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT is_admin_request() THEN
    RETURN json_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  UPDATE used_gear_listings
  SET
    status     = p_status,
    admin_note = COALESCE(
                   p_admin_note,
                   CASE WHEN p_status = 'approved' THEN '' ELSE admin_note END
                 )
  WHERE id = p_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_update_listing_status(uuid, text, text) TO authenticated;
