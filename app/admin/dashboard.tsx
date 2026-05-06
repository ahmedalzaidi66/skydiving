import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import { Package, ShoppingCart, Users, TrendingUp, Clock, CircleCheck as CheckCircle, Truck, Circle as XCircle, RotateCcw, DollarSign, CircleMinus as MinusCircle, Calendar, X } from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Revenue status groups ─────────────────────────────────────────────────────

const GROSS_STATUSES   = new Set(['confirmed', 'processing', 'shipped', 'delivered']);
const REFUND_STATUSES  = new Set(['refunded', 'returned']);
const CANCEL_STATUSES  = new Set(['cancelled', 'rejected']);

// ─── Types ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  total: number;
  status: string;
  created_at: string;
};

type Stats = {
  totalOrders: number;
  pending: number;
  confirmed: number;
  delivered: number;
  cancelledRejected: number;
  refundedReturned: number;
  products: number;
  customers: number;
  grossRevenue: number;
  refundedAmount: number;
  netRevenue: number;
};

type DateFilter = {
  from: string;
  to: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case 'pending':    return Colors.warning;
    case 'confirmed':  return Colors.success;
    case 'processing': return Colors.neonBlue;
    case 'shipped':    return '#7C83FF';
    case 'delivered':  return Colors.success;
    case 'cancelled':
    case 'rejected':   return Colors.error;
    case 'refunded':
    case 'returned':   return Colors.textMuted;
    default:           return Colors.textMuted;
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

// ─── DashboardContent ──────────────────────────────────────────────────────────

function DashboardContent() {
  const router = useRouter();
  const { t } = useLanguage();

  const [stats, setStats]               = useState<Stats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);

  // Draft inputs — only applied on "Apply"
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput]     = useState('');
  // Active filter — null means no filter
  const [activeFilter, setActiveFilter] = useState<DateFilter | null>(null);
  const [filterError, setFilterError]   = useState('');

  const fetchStats = useCallback(async (filter: DateFilter | null) => {
    setLoading(true);

    let ordersQuery = supabase
      .from('orders')
      .select('id, customer_email, customer_first_name, customer_last_name, total, status, created_at')
      .order('created_at', { ascending: false });

    if (filter) {
      ordersQuery = ordersQuery
        .gte('created_at', `${filter.from}T00:00:00.000Z`)
        .lte('created_at', `${filter.to}T23:59:59.999Z`);
    }

    const [productsRes, ordersRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      ordersQuery,
    ]);

    const all: OrderRow[] = (ordersRes.data ?? []).map((o: any) => ({
      ...o,
      total: Number(o.total) || 0,
    }));

    const uniqueCustomers = new Set(all.map((o) => o.customer_email)).size;

    const grossRevenue = all
      .filter((o) => GROSS_STATUSES.has(o.status))
      .reduce((s, o) => s + o.total, 0);

    const refundedAmount = all
      .filter((o) => REFUND_STATUSES.has(o.status))
      .reduce((s, o) => s + o.total, 0);

    const netRevenue = grossRevenue - refundedAmount;

    setStats({
      totalOrders:      all.length,
      pending:          all.filter((o) => o.status === 'pending').length,
      confirmed:        all.filter((o) => o.status === 'confirmed' || o.status === 'processing').length,
      delivered:        all.filter((o) => o.status === 'delivered').length,
      cancelledRejected:all.filter((o) => CANCEL_STATUSES.has(o.status)).length,
      refundedReturned: all.filter((o) => REFUND_STATUSES.has(o.status)).length,
      products:         productsRes.count ?? 0,
      customers:        uniqueCustomers,
      grossRevenue,
      refundedAmount,
      netRevenue,
    });

    setRecentOrders(all.slice(0, 8));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats(activeFilter);
  }, [activeFilter, fetchStats]);

  const handleApply = () => {
    setFilterError('');
    if (!fromInput && !toInput) {
      setActiveFilter(null);
      return;
    }
    if (!isValidDate(fromInput)) { setFilterError('Enter a valid From date (YYYY-MM-DD)'); return; }
    if (!isValidDate(toInput))   { setFilterError('Enter a valid To date (YYYY-MM-DD)');   return; }
    if (fromInput > toInput)     { setFilterError('"From" must be before "To"');            return; }
    setActiveFilter({ from: fromInput, to: toInput });
  };

  const handleClear = () => {
    setFromInput('');
    setToInput('');
    setFilterError('');
    setActiveFilter(null);
  };

  return (
    <View style={styles.container}>

      {/* ── Date Range Filter ── */}
      <View style={styles.filterCard}>
        <View style={styles.filterTitleRow}>
          <Calendar size={15} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.filterTitle}>Date Range Filter</Text>
          {activeFilter && (
            <View style={styles.activeFilterBadge}>
              <Text style={styles.activeFilterText}>Active</Text>
            </View>
          )}
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterInputWrap}>
            <Text style={styles.filterLabel}>From</Text>
            <TextInput
              style={styles.filterInput}
              value={fromInput}
              onChangeText={setFromInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.filterInputWrap}>
            <Text style={styles.filterLabel}>To</Text>
            <TextInput
              style={styles.filterInput}
              value={toInput}
              onChangeText={setToInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {filterError ? (
          <Text style={styles.filterError}>{filterError}</Text>
        ) : null}

        <View style={styles.filterActions}>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
            <Text style={styles.applyBtnText}>Apply Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
            <X size={14} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : (
        <>
          {/* ── Top 3 cards: Products / Orders / Customers ── */}
          <View style={styles.statsGrid}>
            <StatCard
              label={t.totalProducts}
              value={stats?.products ?? 0}
              icon={<Package size={20} color={Colors.neonBlue} strokeWidth={2} />}
              color={Colors.neonBlue}
              onPress={() => router.push('/admin/panel?tab=products' as any)}
            />
            <StatCard
              label="Total Orders"
              value={stats?.totalOrders ?? 0}
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

          {/* ── Revenue block ── */}
          <View style={styles.revenueBlock}>
            <RevenueCard
              label="Gross Revenue"
              value={stats?.grossRevenue ?? 0}
              sub="Confirmed + shipped + delivered"
              icon={<DollarSign size={18} color={Colors.neonBlue} strokeWidth={2} />}
              valueColor={Colors.neonBlue}
            />
            <RevenueCard
              label="Refunded Amount"
              value={stats?.refundedAmount ?? 0}
              sub="Refunded / returned orders"
              icon={<MinusCircle size={18} color={Colors.error} strokeWidth={2} />}
              valueColor={Colors.error}
              negative
            />
            <View style={styles.netRevenueCard}>
              <View style={styles.revenueRow}>
                <TrendingUp size={18} color={Colors.success} strokeWidth={2} />
                <Text style={[styles.revenueLabel, { color: Colors.textSecondary }]}>Net Revenue</Text>
              </View>
              <Text style={styles.netRevenueValue}>${fmt(stats?.netRevenue ?? 0)}</Text>
              <Text style={styles.revenueSub}>Gross minus refunds</Text>
            </View>
          </View>

          {/* ── Order status pills ── */}
          <View style={styles.statusGrid}>
            <StatusPill
              label="Pending"
              count={stats?.pending ?? 0}
              color={Colors.warning}
              icon={<Clock size={13} color={Colors.warning} strokeWidth={2} />}
            />
            <StatusPill
              label="Confirmed"
              count={stats?.confirmed ?? 0}
              color={Colors.neonBlue}
              icon={<CheckCircle size={13} color={Colors.neonBlue} strokeWidth={2} />}
            />
            <StatusPill
              label="Delivered"
              count={stats?.delivered ?? 0}
              color={Colors.success}
              icon={<Truck size={13} color={Colors.success} strokeWidth={2} />}
            />
            <StatusPill
              label="Cancelled"
              count={stats?.cancelledRejected ?? 0}
              color={Colors.error}
              icon={<XCircle size={13} color={Colors.error} strokeWidth={2} />}
            />
            <StatusPill
              label="Refunded"
              count={stats?.refundedReturned ?? 0}
              color={Colors.textMuted}
              icon={<RotateCcw size={13} color={Colors.textMuted} strokeWidth={2} />}
            />
          </View>

          {/* ── Recent Orders ── */}
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
                    <Text style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
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

          {/* ── Quick nav ── */}
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
        </>
      )}
    </View>
  );
}

// ─── Screen wrappers ───────────────────────────────────────────────────────────

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

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, onPress }: {
  label: string; value: number; icon: React.ReactNode; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderColor: color + '30' }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>{icon}</View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function RevenueCard({ label, sub, value, icon, valueColor, negative }: {
  label: string; sub: string; value: number; icon: React.ReactNode;
  valueColor: string; negative?: boolean;
}) {
  return (
    <View style={[styles.revenueCard, { borderColor: valueColor + '30' }]}>
      <View style={styles.revenueRow}>
        {icon}
        <Text style={styles.revenueLabel}>{label}</Text>
      </View>
      <Text style={[styles.revenueValue, { color: valueColor }]}>
        {negative ? '−' : ''}${fmt(value)}
      </Text>
      <Text style={styles.revenueSub}>{sub}</Text>
    </View>
  );
}

function StatusPill({ label, count, color, icon }: {
  label: string; count: number; color: string; icon: React.ReactNode;
}) {
  return (
    <View style={[styles.statusPillCard, { borderColor: color + '30' }]}>
      {icon}
      <Text style={[styles.statusPillCount, { color }]}>{count}</Text>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
  },

  // Filter card
  filterCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    flex: 1,
  },
  activeFilterBadge: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeFilterText: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterInputWrap: {
    flex: 1,
    gap: 4,
  },
  filterLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  filterError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 2,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Stat cards
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

  // Revenue block
  revenueBlock: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  revenueCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 4,
  },
  netRevenueCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    gap: 4,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  revenueValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  netRevenueValue: {
    color: Colors.success,
    fontSize: 32,
    fontWeight: '900',
  },
  revenueSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },

  // Status pills
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusPillCard: {
    flex: 1,
    minWidth: '17%',
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

  // Recent orders
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
    marginTop: 1,
  },
  orderDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
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

  // Quick nav
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
