/*
  # Fix employee self-read RLS policy

  The previous policy used a subquery against auth.users to get the email,
  which caused "permission denied for table users" on the client.

  Replace it with a policy that only uses auth.uid() and auth.email(),
  both of which are safe built-in Supabase helpers that never touch auth.users directly.
*/

DROP POLICY IF EXISTS "Employee can read own record" ON employees;

CREATE POLICY "Employee can read own record"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR email = auth.email()
  );
