/*
  # Admin approve/reject listing RPCs

  1. New Functions
    - `admin_update_listing_status(p_id, p_status, p_admin_note)` — SECURITY DEFINER
      Validates the caller is an active admin via x-admin-token header,
      then updates the listing status and admin_note in one safe operation.
      Clears admin_note when approving (sets to empty string) unless a note is supplied.

  2. Notes
    - Runs as SECURITY DEFINER so it bypasses RLS entirely after token validation
    - Token validation reuses the same is_admin_request() logic
*/

CREATE OR REPLACE FUNCTION public.admin_update_listing_status(
  p_id        uuid,
  p_status    text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin_request() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE used_gear_listings
  SET
    status     = p_status,
    admin_note = COALESCE(p_admin_note, CASE WHEN p_status = 'approved' THEN '' ELSE admin_note END)
  WHERE id = p_id;
END;
$$;
