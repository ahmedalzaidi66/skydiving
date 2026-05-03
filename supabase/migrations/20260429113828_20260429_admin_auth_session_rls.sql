/*
  # Admin Auth Session RLS

  Allow authenticated employees (signed in via Supabase Auth) to:
  1. Read their own employee row — needed for permission/role lookup after login
  2. Allow the shared supabase client (carrying auth.uid()) to be used for
     storage uploads without requiring x-admin-token on storage operations.

  ## Changes
  - employees: add SELECT policy for authenticated users reading their own row
    (matched by auth_user_id column)
  - No changes to existing is_admin_request() policies — they remain for table writes

  ## Notes
  - Storage already has "Authenticated users can upload" policies — no storage changes needed
  - SECURITY DEFINER RPCs (verify_admin_credentials, get_employee_permissions) bypass RLS
    so they continue to work for the login flow
*/

-- Allow an authenticated Supabase Auth user to read their own employee record
-- This is needed after login to validate the admin role without requiring x-admin-token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employees'
      AND policyname = 'Employee can read own record by auth uid'
  ) THEN
    CREATE POLICY "Employee can read own record by auth uid"
      ON employees FOR SELECT
      TO authenticated
      USING (auth_user_id = auth.uid());
  END IF;
END $$;
