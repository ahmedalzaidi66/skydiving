import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Search,
  X,
  Clock,
  User,
  Package,
  ShoppingCart,
  Tag,
  Layers2,
  Settings,
  UserCog,
  ShieldAlert,
  Image,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import AdminGuard from '@/components/admin/AdminGuard';
import { fetchAuditLogs, AuditLog } from '@/lib/audit';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const ENTITY_ICONS: Record<string, any> = {
  product:     Package,
  category:    Layers2,
  order:       ShoppingCart,
  coupon:      Tag,
  settings:    Settings,
  employee:    UserCog,
  permissions: ShieldAlert,
  hero_slide:  Image,
  used_gear:   Package,
};

const ACTION_COLORS: Record<string, string> = {
  create:  Colors.success,
  update:  Colors.neonBlue,
  delete:  Colors.error,
  approve: Colors.success,
  reject:  Colors.error,
  verify:  Colors.neonBlue,
  hide:    Colors.warning,
  restore: Colors.warning,
  cancel:  Colors.error,
  status_update: Colors.neonBlue,
  role_update:   Colors.warning,
  employee_update: Colors.neonBlue,
};

function actionColor(action: string): string {
  const verb = action.split('.')[1] ?? action;
  return ACTION_COLORS[verb] ?? Colors.textMuted;
}

function actionLabel(action: string): string {
  return action.replace(/\./g, ' › ').replace(/_/g, ' ');
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ENTITY_TYPES = ['', 'product', 'category', 'order', 'coupon', 'settings', 'employee', 'permissions', 'hero_slide', 'used_gear'];

function ActivityContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  // Filters
  const [adminEmail, setAdminEmail] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (reset = false) => {
    const offset = reset ? 0 : page * PAGE_SIZE;
    if (reset) setLoading(true); else setLoadingMore(true);

    const { data, count, error } = await fetchAuditLogs({
      adminEmail: adminEmail.trim() || undefined,
      entityType: entityType || undefined,
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
      limit: PAGE_SIZE,
      offset,
    });

    if (reset) {
      setLogs(data);
      setPage(1);
    } else {
      setLogs((prev) => [...prev, ...data]);
      setPage((p) => p + 1);
    }
    setTotal(count);
    setLoading(false);
    setLoadingMore(false);
  }, [adminEmail, entityType, dateFrom, dateTo, page]);

  useEffect(() => {
    load(true);
  }, [adminEmail, entityType, dateFrom, dateTo]);

  const hasMore = logs.length < total;

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Search size={14} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={adminEmail}
            onChangeText={setAdminEmail}
            placeholder="Filter by admin email..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {adminEmail !== '' && (
            <TouchableOpacity onPress={() => setAdminEmail('')}>
              <X size={14} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.entityScroll} contentContainerStyle={styles.entityRow}>
          {ENTITY_TYPES.map((et) => (
            <TouchableOpacity
              key={et || '__all__'}
              style={[styles.filterChip, entityType === et && styles.filterChipActive]}
              onPress={() => setEntityType(et)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, entityType === et && styles.filterChipTextActive]}>
                {et === '' ? 'All' : et.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.dateRow}>
          <View style={styles.dateInput}>
            <Text style={styles.dateLabel}>From</Text>
            <TextInput
              style={styles.dateField}
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.dateInput}>
            <Text style={styles.dateLabel}>To</Text>
            <TextInput
              style={styles.dateField}
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => load(true)}
            activeOpacity={0.7}
          >
            <RefreshCw size={15} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.countText}>{total} event{total !== 1 ? 's' : ''} total</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.center}>
          <Clock size={40} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>No activity logs found.</Text>
        </View>
      ) : (
        <>
          {logs.map((log, idx) => {
            const EntityIcon = ENTITY_ICONS[log.entity_type] ?? Package;
            const color = actionColor(log.action);
            const isExpanded = expandedId === log.id;
            const isLast = idx === logs.length - 1;

            return (
              <View key={log.id} style={[styles.timelineItem, isLast && styles.timelineItemLast]}>
                {/* Timeline line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  {!isLast && <View style={styles.line} />}
                </View>

                {/* Content card */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setExpandedId(isExpanded ? null : log.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.entityIcon, { backgroundColor: color + '18', borderColor: color + '44' }]}>
                      <EntityIcon size={14} color={color} strokeWidth={2} />
                    </View>
                    <View style={styles.cardMain}>
                      <View style={styles.actionRow}>
                        <View style={[styles.actionBadge, { backgroundColor: color + '15', borderColor: color + '44' }]}>
                          <Text style={[styles.actionBadgeText, { color }]}>{actionLabel(log.action)}</Text>
                        </View>
                        {log.entity_label && (
                          <Text style={styles.entityLabel} numberOfLines={1}>{log.entity_label}</Text>
                        )}
                      </View>
                      <View style={styles.metaRow}>
                        <User size={11} color={Colors.textMuted} strokeWidth={2} />
                        <Text style={styles.metaText}>{log.admin_email}</Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Clock size={11} color={Colors.textMuted} strokeWidth={2} />
                        <Text style={styles.metaText}>{timeAgo(log.created_at)}</Text>
                      </View>
                    </View>
                    {isExpanded
                      ? <ChevronUp size={14} color={Colors.textMuted} strokeWidth={2} />
                      : <ChevronDown size={14} color={Colors.textMuted} strokeWidth={2} />
                    }
                  </View>

                  {isExpanded && (
                    <View style={styles.cardDetail}>
                      <Text style={styles.detailDate}>
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                      {log.entity_id && (
                        <Text style={styles.detailId}>ID: {log.entity_id}</Text>
                      )}
                      {log.old_values && (
                        <View style={styles.valuesBlock}>
                          <Text style={styles.valuesLabel}>Before</Text>
                          <Text style={styles.valuesText}>{JSON.stringify(log.old_values, null, 2)}</Text>
                        </View>
                      )}
                      {log.new_values && (
                        <View style={[styles.valuesBlock, styles.valuesBlockNew]}>
                          <Text style={[styles.valuesLabel, { color: Colors.success }]}>After</Text>
                          <Text style={styles.valuesText}>{JSON.stringify(log.new_values, null, 2)}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          {hasMore && (
            <TouchableOpacity
              style={[styles.loadMoreBtn, loadingMore && { opacity: 0.6 }]}
              onPress={() => load(false)}
              disabled={loadingMore}
              activeOpacity={0.8}
            >
              {loadingMore
                ? <ActivityIndicator color={Colors.neonBlue} size="small" />
                : <Text style={styles.loadMoreText}>Load more ({total - logs.length} remaining)</Text>
              }
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function ActivityScreen() {
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title="Activity Log" showBack>
        <MobileUnsupported featureName="Activity Log" />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title="Activity Log">
      <ActivityContent />
    </AdminWebDashboard>
  );
}

export default function ActivityScreenGuarded() {
  return (
    <AdminGuard permission="view_dashboard">
      <ActivityScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
  },
  filterBar: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  entityScroll: {
    flexShrink: 0,
  },
  entityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12,
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
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: Colors.neonBlue,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 38,
  },
  dateLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  dateField: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  timelineItemLast: {
    paddingBottom: 0,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
    paddingTop: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  entityIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardMain: {
    flex: 1,
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  entityLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  metaDot: {
    color: Colors.border,
    fontSize: FontSize.xs,
  },
  cardDetail: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  detailDate: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  detailId: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: 'monospace' as any,
  },
  valuesBlock: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 4,
  },
  valuesBlockNew: {
    borderColor: Colors.success + '33',
    backgroundColor: Colors.success + '08',
  },
  valuesLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valuesText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace' as any,
    lineHeight: 16,
  },
  loadMoreBtn: {
    marginTop: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadMoreText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
