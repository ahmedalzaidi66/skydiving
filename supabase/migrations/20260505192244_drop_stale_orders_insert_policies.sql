/*
  # Drop stale orders INSERT policies

  Two old policies survived previous migrations because they had different names.
  "orders insert authenticated" contains a jwt email-match clause that can block
  inserts in edge cases. "orders insert guest" is a duplicate of the correct one.

  The two correct policies ("Users can insert orders" and "Guests can insert orders")
  already exist. This migration removes only the stale duplicates.
*/

drop policy if exists "orders insert authenticated" on orders;
drop policy if exists "orders insert guest" on orders;
