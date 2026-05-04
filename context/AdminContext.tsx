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

const ADMIN_ROLE_KEYS = ['super_admin', 'admin'];

type AdminContextType = {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  isHydrated: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => void;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

async function fetchPermissions(email: string): Promise<string[]> {
  const { data } = await supabase.rpc('get_employee_permissions', { p_email: email });
  return data ? (data as { permission_key: string }[]).map((p) => p.permission_key) : [];
}

type EmployeeWithRole = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: { key: string } | null;
};

async function fetchEmployeeWithRole(authUserId: string, email: string): Promise<EmployeeWithRole | null> {
  // Try by auth_user_id first, fall back to email
  let { data } = await supabase
    .from('employees')
    .select('id, email, full_name, is_active, roles(key)')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) {
    const res = await supabase
      .from('employees')
      .select('id, email, full_name, is_active, roles(key)')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();
    data = res.data;
  }

  return data as EmployeeWithRole | null;
}

async function hydrateAdminFromSession(
  authUserId: string,
  email: string,
  setAdmin: (u: AdminUser | null) => void,
): Promise<void> {
  const emp = await fetchEmployeeWithRole(authUserId, email);
  if (!emp) return;

  const roleKey = emp.roles?.key ?? '';
  if (!ADMIN_ROLE_KEYS.includes(roleKey)) return;

  const permissions = await fetchPermissions(emp.email);
  setAdmin({ id: emp.id, email: emp.email, name: emp.full_name, role: roleKey, permissions });
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await hydrateAdminFromSession(session.user.id, session.user.email ?? '', setAdmin);
      }
      setIsHydrated(true);
    })();
  }, []);

  const adminLogin = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const emailLower = email.trim().toLowerCase();
    // Raw password — no trimming to preserve exact user input
    const rawPassword = password;

    console.log('[AdminLogin] email:', emailLower, '| password length:', rawPassword.length);

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password: rawPassword,
    });

    console.log('[AdminLogin] auth result:', authData?.user?.id ?? null, '| error:', authErr?.message ?? null);

    if (authErr || !authData.user) {
      return { success: false, error: authErr?.message ?? 'Invalid credentials' };
    }

    const emp = await fetchEmployeeWithRole(authData.user.id, emailLower);

    console.log('[AdminLogin] employee row:', emp ? `id=${emp.id} role=${emp.roles?.key}` : 'NOT FOUND');

    if (!emp) {
      await supabase.auth.signOut();
      return { success: false, error: 'Admin profile not found' };
    }

    const roleKey = emp.roles?.key ?? '';
    if (!ADMIN_ROLE_KEYS.includes(roleKey)) {
      await supabase.auth.signOut();
      return { success: false, error: 'You do not have admin access' };
    }

    const { data: tokenData } = await supabase.rpc('issue_admin_token_for_auth_user', {
      p_auth_user_id: authData.user.id,
    });
    if (tokenData) setAdminSessionToken(tokenData);

    const permissions = await fetchPermissions(emailLower);
    setAdmin({ id: emp.id, email: emp.email, name: emp.full_name, role: roleKey, permissions });
    return { success: true };
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
