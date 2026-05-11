import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldOff, ArrowLeft } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase, getAdminToken } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const ADMIN_ROLES = new Set(['super_admin', 'admin']);

type Props = {
  permission: string;
  children: React.ReactNode;
};

/**
 * Guards an admin screen with two layers:
 * 1. Client state check (fast path — already loaded from AdminContext)
 * 2. Server-side token verification via `verify_admin_session` RPC (real protection)
 *
 * If either check fails the user is redirected to /admin/login.
 */
export default function AdminGuard({ permission, children }: Props) {
  const router = useRouter();
  const { admin, isAdminAuthenticated, isHydrated } = useAdmin();
  const { hasPermission } = usePermissions();

  // 'pending' = server check in flight | 'ok' = verified | 'denied' = failed
  const [serverCheck, setServerCheck] = useState<'pending' | 'ok' | 'denied'>('pending');

  useEffect(() => {
    if (!isHydrated) return;

    // Fast-fail if client state already says not authenticated
    if (!isAdminAuthenticated || !admin) {
      router.replace('/admin/login');
      return;
    }

    // Server-side verification: confirm the token is still valid in the DB
    const token = getAdminToken();
    if (!token) {
      router.replace('/admin/login');
      return;
    }

    let cancelled = false;
    supabase.rpc('verify_admin_session', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;

      if (error || !data || (data as any[]).length === 0) {
        router.replace('/admin/login');
        setServerCheck('denied');
        return;
      }

      const row = (data as any[])[0];
      if (!row.is_active || !ADMIN_ROLES.has(row.role_key)) {
        router.replace('/admin/login');
        setServerCheck('denied');
        return;
      }

      setServerCheck('ok');
    });

    return () => { cancelled = true; };
  }, [isHydrated, isAdminAuthenticated]);

  // Loading: either context not hydrated yet or server check in flight
  if (!isHydrated || serverCheck === 'pending') {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  if (!isAdminAuthenticated || serverCheck === 'denied') return null;

  if (!hasPermission(permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <ShieldOff size={52} color={Colors.error} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Access Denied</Text>
      <Text style={styles.subtitle}>
        You don't have permission to view this section.{'\n'}
        Contact your administrator to request access.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace('/admin/panel?tab=dashboard' as any)}
        activeOpacity={0.8}
      >
        <ArrowLeft size={16} color={Colors.background} strokeWidth={2} />
        <Text style={styles.btnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  btnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
