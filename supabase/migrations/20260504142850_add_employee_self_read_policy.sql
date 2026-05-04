/*
  # Add employee self-read RLS policy

  Allows an authenticated user to read their own employee record,
  matched by auth_user_id = auth.uid() OR email = auth.email().
  Required for the admin login flow to fetch the employee + role after
  signInWithPassword succeeds.
*/

CREATE POLICY "Employee can read own record"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
