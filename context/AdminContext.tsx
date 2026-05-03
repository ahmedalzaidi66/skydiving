import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase, setAdminSessionToken } from '@/lib/supabase';

export type AdminRole = 'super_admin' | 'admin' | 'employee' | 'product_manager' | 'order_manager' | 'customer_support' | 'content_editor';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole | string;
  permissions: string[];
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin:      'Super Admin',
  admin:            'Admin',
  employee:         'Employee',
  product_manager:  'Product Manager',
  order_manager:    'Order Manager',
  customer_support: 'Customer Support',
  content_editor:   'Content Editor',
};

export const PERMISSION_ROUTES: Record<string, string> = {
  view_dashboard:      '/admin/dashboard',
  manage_products:     '/admin/products',
  manage_orders:       '/admin/orders',
  manage_customers:    '/admin/customers',
  manage_employees:    '/admin/employees',
  manage_reviews:      '/admin/reviews',
  manage_coupons:      '/admin/coupons',
  manage_cms:          '/admin/content',
  manage_cms_builder:  '/admin/builder',
  manage_layout:       '/admin/layout',
  manage_theme:        '/admin/sizes',
  manage_settings:     '/admin/settings',
  manage_permissions:  '/admin/permissions',
};

export const ROUTE_PERMISSION: Record<string, string> = {
  '/admin/dashboard':   'view_dashboard',
  '/admin/products':    'manage_products',
  '/admin/orders':      'manage_orders',
  '/admin/customers':   'manage_customers',
  '/admin/employees':   'manage_employees',
  '/admin/reviews':     'manage_reviews',
  '/admin/coupons':     'manage_coupons',
  '/admin/content':     'manage_cms',
  '/admin/builder':     'manage_cms',
  '/admin/layout':      'manage_layout',
  '/admin/sizes':       'manage_layout',
  '/admin/settings':    'manage_settings',
  '/admin/permissions': 'manage_permissions',
};

type AdminContextType = {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  isHydrated: boolean;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureAuthUser(
  email: string,
  password: string,
  fullName: string,
  adminToken: string,
): Promise<void> {
  try {
    const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-employee-auth`;
    await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ action: 'ensure_auth_user', email, password, full_name: fullName }),
    });
  } catch {
    // Non-fatal
  }
}

async function fetchPermissions(email: string): Promise<string[]> {
  const { data } = await supabase.rpc('get_employee_permissions', { p_email: email });
  return data ? (data as { permission_key: string }[]).map((p) => p.permission_key) : [];
}

async function hydrateAdminFromEmail(
  email: string,
  setAdmin: (u: AdminUser | null) => void,
): Promise<void> {
  if (!email) return;
  const emailLower = email.toLowerCase();
  // employees SELECT is allowed via either is_admin_request() or the new
  // "Employee can read own record by auth uid" policy added in migration.
  const { data: emp } = await supabase
    .from('employees')
    .select('id, email, full_name, role, is_active')
    .eq('email', emailLower)
    .eq('is_active', true)
    .maybeSingle();

  if (!emp || emp.role === 'user') return;
  const permissions = await fetchPermissions(emailLower);
  setAdmin({ id: emp.id, email: emp.email, name: emp.full_name, role: emp.role, permissions });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore session from existing Supabase Auth on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        await hydrateAdminFromEmail(session.user.email, setAdmin);
      }
      setIsHydrated(true);
    })();
  }, []);

  const adminLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    const emailLower = email.trim().toLowerCase();

    // ── Step 1: verify admin credentials via legacy password_hash ─────────────
    // This RPC is SECURITY DEFINER so it bypasses RLS and works for all admins.
    const { data: credData } = await supabase.rpc('verify_admin_credentials', {
      p_email: emailLower,
      p_password: password,
    });

    if (credData && credData.length > 0) {
      const row = credData[0];
      if (row.role === 'user') return false;

      const sessionToken: string = row.session_token ?? '';

      // Store x-admin-token for is_admin_request() table RLS policies
      setAdminSessionToken(sessionToken);

      // ── Step 2: provision Supabase Auth account with the REAL password ──────
      // Pass the real login password (not the session token) so that
      // signInWithPassword(email, realPassword) works directly.
      // The session token is sent as x-admin-token to authorize the edge function.
      await ensureAuthUser(emailLower, password, row.full_name ?? '', sessionToken);

      // ── Step 3: sign in with real credentials to get a valid JWT session ────
      // This JWT is what storage RLS checks via auth.uid() IS NOT NULL.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password,
      });
      if (signInErr) {
        console.warn('[AdminContext] Auth sign-in failed:', signInErr.message);
      }

      const permissions = await fetchPermissions(emailLower);
      setAdmin({ id: row.id, email: row.email, name: row.full_name, role: row.role, permissions });
      return true;
    }

    // ── Fallback: employee already has a Supabase Auth account ────────────────
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password,
    });
    if (authErr || !authData.user) return false;

    const { data: emp } = await supabase
      .from('employees')
      .select('id, email, full_name, role, is_active')
      .eq('auth_user_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!emp || emp.role === 'user') {
      await supabase.auth.signOut();
      return false;
    }

    // Issue x-admin-token for is_admin_request() table policies
    const { data: tokenData } = await supabase.rpc('issue_admin_token_for_auth_user', {
      p_auth_user_id: authData.user.id,
    });
    if (tokenData) setAdminSessionToken(tokenData);

    const permissions = await fetchPermissions(emailLower);
    setAdmin({ id: emp.id, email: emp.email, name: emp.full_name, role: emp.role, permissions });
    return true;
  }, []);

  const adminLogout = useCallback(() => {
    setAdmin(null);
    setAdminSessionToken(null);
    supabase.auth.signOut();
  }, []);

  return (
    <AdminContext.Provider value={{ admin, isAdminAuthenticated: !!admin, isHydrated, adminLogin, adminLogout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
