import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  Clock,
  CircleCheck as CheckCircle,
  Truck,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type Stats = {
  products: number;
  orders: number;
  customers: number;
  revenue: number;
  pendingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
};

function statusColor(status: string) {
  switch (status) {
    case 'pending': return Colors.warning;
    case 'processing': return Colors.neonBlue;
    case 'shipped': return '#7C83FF';
    case 'delivered': return Colors.success;
    case 'cancelled': return Colors.error;
    default: return Colors.textMuted;
  }
}

function DashboardContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [productsRes, ordersRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase
        .from('orders')
        .select('id, customer_email, total, status, created_at, customer_first_name, customer_last_name')
        .order('created_at', { ascending: false }),
    ]);

    const allOrders = ordersRes.data ?? [];
    const uniqueCustomers = new Set(allOrders.map((o: any) => o.customer_email)).size;
    const revenue = allOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

    setStats({
      products: productsRes.count ?? 0,
      orders: allOrders.length,
      customers: uniqueCustomers,
      revenue,
      pendingOrders: allOrders.filter((o: any) => o.status === 'pending').length,
      shippedOrders: allOrders.filter((o: any) => o.status === 'shipped').length,
      deliveredOrders: allOrders.filter((o: any) => o.status === 'delivered').length,
    });
    setRecentOrders(allOrders.slice(0, 5));
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsGrid}>
        <StatCard
          label={t.totalProducts}
          value={stats?.products ?? 0}
          icon={<Package size={20} color={Colors.neonBlue} strokeWidth={2} />}
          color={Colors.neonBlue}
          onPress={() => router.push('/admin/panel?tab=products' as any)}
        />
        <StatCard
          label={t.totalOrders}
          value={stats?.orders ?? 0}
          icon={<ShoppingCart size={20} color={Colors.success} strokeWidth={2} />}
          color={Colors.success}
          onPress={() => router.push('/admin/panel?tab=orders' as any)}
        />
        <StatCard
          label={t.totalCustomers}
          value={stats?.customers ?? 0}
          icon={<Users size={20} color={Colors.warning} strokeWidth={2} />}
          color={Colors.warning}
          onPress={() => router.push('/admin/panel?tab=customers' as any)}
        />
      </View>

      <View style={styles.revenueCard}>
        <View style={styles.revenueRow}>
          <TrendingUp size={20} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.revenueLabel}>{t.totalRevenue}</Text>
        </View>
        <Text style={styles.revenueValue}>
          ${(stats?.revenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label={t.pending} count={stats?.pendingOrders ?? 0} color={Colors.warning} icon={<Clock size={13} color={Colors.warning} strokeWidth={2} />} />
        <StatusPill label={t.shipped} count={stats?.shippedOrders ?? 0} color="#7C83FF" icon={<Truck size={13} color="#7C83FF" strokeWidth={2} />} />
        <StatusPill label={t.delivered} count={stats?.deliveredOrders ?? 0} color={Colors.success} icon={<CheckCircle size={13} color={Colors.success} strokeWidth={2} />} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.recentOrders}</Text>
          <TouchableOpacity onPress={() => router.push('/admin/panel?tab=orders' as any)}>
            <Text style={styles.seeAll}>{t.seeAll}</Text>
          </TouchableOpacity>
        </View>
        {recentOrders.length === 0 ? (
          <Text style={styles.emptyText}>{t.noOrdersFound}</Text>
        ) : (
          recentOrders.map((order) => (
            <View key={order.id} style={styles.orderRow}>
              <View style={styles.orderLeft}>
                <Text style={styles.orderName}>
                  {order.customer_first_name} {order.customer_last_name}
                </Text>
                <Text style={styles.orderEmail} numberOfLines={1}>{order.customer_email}</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderTotal}>${Number(order.total).toFixed(2)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + '22' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor(order.status) }]}>
                    {order.status}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.quickGrid}>
        {[
          { label: t.manageOrders,  tab: 'orders'    },
          { label: t.viewCustomers, tab: 'customers' },
          { label: t.editProducts,  tab: 'products'  },
          { label: t.settings,      tab: 'settings'  },
        ].map((link) => (
          <TouchableOpacity
            key={link.tab}
            style={styles.quickBtn}
            onPress={() => router.push(`/admin/panel?tab=${link.tab}` as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickBtnText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function DashboardScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.dashboard} showQuickNav>
        <DashboardContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.dashboard}>
      <DashboardContent />
    </AdminWebDashboard>
  );
}

export default function DashboardScreenGuarded() {
  return (
    <AdminGuard permission="view_dashboard">
      <DashboardScreen />
    </AdminGuard>
  );
}

function StatCard({ label, value, icon, color, onPress }: { label: string; value: number; icon: React.ReactNode; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderColor: color + '30' }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>{icon}</View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  return (
    <View style={[styles.statusPillCard, { borderColor: color + '30' }]}>
      {icon}
      <Text style={[styles.statusPillCount, { color }]}>{count}</Text>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  revenueCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    marginBottom: Spacing.md,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  revenueLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  revenueValue: {
    color: Colors.neonBlue,
    fontSize: 32,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusPillCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  statusPillCount: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  statusPillLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  seeAll: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  orderName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  orderEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderTotal: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  quickBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
