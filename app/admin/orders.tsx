import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, ChevronRight, CircleCheck, CircleX } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { supabase, adminSupabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type Order = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.success,
  processing: Colors.neonBlue,
  shipped: '#7C83FF',
  delivered: Colors.success,
  cancelled: Colors.error,
  rejected: Colors.error,
  refunded: Colors.textMuted,
};

const STOCK_RESTORE_STATUSES = ['cancelled', 'rejected', 'refunded'];

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'rejected', 'refunded'];

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? Colors.textMuted;
}

function OrdersContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, customer_first_name, customer_last_name, customer_email, total, status, created_at')
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  };

  const openOrder = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingItems(true);
    const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    setOrderItems(data ?? []);
    setLoadingItems(false);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true);
    const prevStatus = selectedOrder?.status ?? '';
    await adminSupabase().from('orders').update({ status: newStatus }).eq('id', orderId);

    // Restore stock when transitioning into cancelled/refunded from a non-restoring status
    const wasRestoring = STOCK_RESTORE_STATUSES.includes(prevStatus);
    const nowRestoring = STOCK_RESTORE_STATUSES.includes(newStatus);
    if (nowRestoring && !wasRestoring) {
      await supabase.rpc('restore_stock_on_cancel', { p_order_id: orderId });
    }

    await fetchOrders();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
    setUpdatingStatus(false);
    setSuccessMsg(t.statusUpdatedMsg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const filtered = orders.filter((o) => {
    const matchSearch =
      search.trim() === '' ||
      `${o.customer_first_name} ${o.customer_last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (selectedOrder) {
    return (
      <View style={styles.detailContainer}>
        <TouchableOpacity style={styles.backRow} onPress={() => setSelectedOrder(null)} activeOpacity={0.7}>
          <Text style={styles.backLink}>{t.backToOrders}</Text>
        </TouchableOpacity>

        <View style={styles.detailCard}>
          <Text style={styles.detailName}>
            {selectedOrder.customer_first_name} {selectedOrder.customer_last_name}
          </Text>
          <Text style={styles.detailEmail}>{selectedOrder.customer_email}</Text>
          <Text style={styles.detailTotal}>${Number(selectedOrder.total).toFixed(2)}</Text>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(selectedOrder.status) + '22' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor(selectedOrder.status) }]}>
              {selectedOrder.status}
            </Text>
          </View>

          <Text style={styles.detailDate}>
            {new Date(selectedOrder.created_at).toLocaleDateString()}
          </Text>
        </View>

        {selectedOrder.status === 'pending' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionBtn, styles.quickActionApprove]}
              onPress={() => updateStatus(selectedOrder.id, 'confirmed')}
              activeOpacity={0.8}
              disabled={updatingStatus}
            >
              <CircleCheck size={18} color={Colors.success} strokeWidth={2} />
              <Text style={[styles.quickActionText, { color: Colors.success }]}>Approve Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, styles.quickActionReject]}
              onPress={() => updateStatus(selectedOrder.id, 'rejected')}
              activeOpacity={0.8}
              disabled={updatingStatus}
            >
              <CircleX size={18} color={Colors.error} strokeWidth={2} />
              <Text style={[styles.quickActionText, { color: Colors.error }]}>Reject Order</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.subTitle}>{t.updateStatusTitle}</Text>
        <View style={styles.statusButtons}>
          {ORDER_STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusBtn,
                {
                  backgroundColor: selectedOrder.status === s ? statusColor(s) + '22' : Colors.backgroundCard,
                  borderColor: selectedOrder.status === s ? statusColor(s) : Colors.border,
                },
              ]}
              onPress={() => updateStatus(selectedOrder.id, s)}
              activeOpacity={0.7}
              disabled={updatingStatus}
            >
              <Text style={[styles.statusBtnText, { color: statusColor(s) }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {successMsg !== '' && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        <Text style={styles.subTitle}>{t.orderItemsTitle}</Text>
        {loadingItems ? (
          <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 16 }} />
        ) : orderItems.length === 0 ? (
          <Text style={styles.emptyText}>{t.noItems}</Text>
        ) : (
          orderItems.map((item, idx) => (
            <View key={item.id ?? idx} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName} numberOfLines={2}>{item.product_name ?? t.productLabel}</Text>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemQty}>{t.qtyLabel} {item.quantity}</Text>
                  {item.selected_color && (
                    <Text style={styles.itemColor}>{item.selected_color}</Text>
                  )}
                </View>
                {item.stock_at_purchase != null && (
                  <Text style={styles.itemStockNote}>
                    Stock at purchase: {item.stock_at_purchase}
                  </Text>
                )}
              </View>
              <Text style={styles.itemPrice}>${((Number(item.unit_price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</Text>
            </View>
          ))
        )}
        {STOCK_RESTORE_STATUSES.includes(selectedOrder?.status ?? '') && (
          <View style={styles.stockRestoredNote}>
            <Text style={styles.stockRestoredText}>Stock has been restored for this order.</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t.searchOrders}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {['all', ...ORDER_STATUSES].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'all' ? t.all : s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>{t.noOrdersFound}</Text>
      ) : (
        filtered.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={styles.orderCard}
            onPress={() => openOrder(order)}
            activeOpacity={0.8}
          >
            <View style={styles.orderCardLeft}>
              <Text style={styles.orderName}>
                {order.customer_first_name} {order.customer_last_name}
              </Text>
              <Text style={styles.orderEmail} numberOfLines={1}>{order.customer_email}</Text>
              <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.orderCardRight}>
              <Text style={styles.orderTotal}>${Number(order.total).toFixed(2)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(order.status) }]}>
                  {order.status}
                </Text>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function OrdersScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.ordersAdmin} showBack>
        <OrdersContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.ordersAdmin}>
      <OrdersContent />
    </AdminWebDashboard>
  );
}

export default function OrdersScreenGuarded() {
  return (
    <AdminGuard permission="manage_orders">
      <OrdersScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  searchRow: {
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: Colors.neonBlue,
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  orderCardLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  orderCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  orderEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  orderDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  orderTotal: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  detailContainer: {
    paddingBottom: 40,
  },
  backRow: {
    marginBottom: Spacing.md,
  },
  backLink: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: 4,
  },
  detailName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  detailEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  detailTotal: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
    marginTop: 4,
  },
  detailDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  subTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  successBanner: {
    backgroundColor: Colors.success + '22',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  itemLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  itemQty: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  itemColor: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  itemStockNote: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  stockRestoredNote: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.success + '15',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.success + '44',
    padding: Spacing.sm,
  },
  stockRestoredText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  itemPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  quickActionApprove: {
    backgroundColor: Colors.success + '15',
    borderColor: Colors.success + '55',
  },
  quickActionReject: {
    backgroundColor: Colors.error + '15',
    borderColor: Colors.error + '55',
  },
  quickActionText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
});
