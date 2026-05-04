/*
  # Allow authenticated users to read roles table

  The roles table has RLS enabled but no policies, making it completely
  inaccessible. The admin login flow joins employees.role_id -> roles.id
  to check roles.key. Without this policy the join silently returns null,
  causing "Admin profile not found" even when the employee row exists.
*/

CREATE POLICY "Authenticated users can read roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);
