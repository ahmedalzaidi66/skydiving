import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Modal, Pressable, ScrollView, ActivityIndicator, I18nManager,
  Platform, SafeAreaView,
} from 'react-native';
import {
  Bell, X, Check, CheckCheck, ShoppingBag, Tag, Heart,
  Megaphone, FileText, Package, Info,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotifications, type AppNotification, type NotificationType } from '@/context/NotificationContext';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(type: NotificationType, color: string) {
  const p = { size: 16, color, strokeWidth: 2 } as const;
  switch (type) {
    case 'order_update':  return <ShoppingBag {...p} />;
    case 'gear_approved': return <Tag {...p} />;
    case 'gear_rejected': return <Tag {...p} />;
    case 'price_drop':    return <Heart {...p} />;
    case 'announcement':  return <Megaphone {...p} />;
    case 'report_update': return <FileText {...p} />;
    case 'campaign':      return <Package {...p} />;
    default:              return <Info {...p} />;
  }
}

function typeAccent(type: NotificationType, C: any): string {
  switch (type) {
    case 'order_update':  return C.neonBlue;
    case 'gear_approved': return C.success;
    case 'gear_rejected': return C.error;
    case 'price_drop':    return '#FF4D6D';
    case 'announcement':  return C.warning;
    case 'report_update': return C.neonBlue;
    case 'campaign':      return C.warning;
    default:              return C.textMuted;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif, C, isRTL, onPress, onMarkRead,
}: {
  notif: AppNotification;
  C: any;
  isRTL: boolean;
  onPress: (n: AppNotification) => void;
  onMarkRead: (id: string) => void;
}) {
  const accent = typeAccent(notif.type, C);
  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: notif.read ? 'transparent' : C.neonBlueGlow,
          borderBottomColor: C.borderLight,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
      onPress={() => onPress(notif)}
      activeOpacity={0.75}
    >
      {/* Unread dot */}
      {!notif.read && (
        <View style={[
          styles.unreadDot,
          { backgroundColor: C.neonBlue, [isRTL ? 'right' : 'left']: 4 },
        ]} />
      )}

      {/* Type icon chip */}
      <View style={[styles.rowIcon, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
        {typeIcon(notif.type, accent)}
      </View>

      {/* Text block */}
      <View style={[styles.rowBody, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <Text style={[styles.rowTitle, { color: C.textPrimary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={[styles.rowMessage, { color: C.textSecondary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
          {notif.message}
        </Text>
        <Text style={[styles.rowTime, { color: C.textMuted }]}>
          {relativeTime(notif.created_at)}
        </Text>
      </View>

      {/* Mark-read button */}
      {!notif.read && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.checkBtn}
        >
          <Check size={14} color={C.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Panel (used inside Modal for both web + mobile) ─────────────────────────

function Panel({ onClose, C, isRTL }: { onClose: () => void; C: any; isRTL: boolean }) {
  const router = useRouter();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

  const handlePress = useCallback((n: AppNotification) => {
    if (!n.read) markRead(n.id);
    onClose();
    if (n.link) setTimeout(() => router.push(n.link as any), 80);
  }, [markRead, onClose, router]);

  return (
    <>
      {/* Header */}
      <View style={[styles.panelHeader, { borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.panelLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.panelTitle, { color: C.textPrimary }]}>
            {isRTL ? 'الإشعارات' : 'Notifications'}
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.countChip, { backgroundColor: C.neonBlue }]}>
              <Text style={[styles.countChipText, { color: C.background }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.panelRight, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              style={[styles.markAllRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              activeOpacity={0.7}
            >
              <CheckCheck size={13} color={C.neonBlue} strokeWidth={2} />
              <Text style={[styles.markAllText, { color: C.neonBlue }]}>
                {isRTL ? 'تحديد الكل' : 'Mark all read'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color={C.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={C.neonBlue} size="small" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerState}>
          <Bell size={36} color={C.textMuted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>
            {isRTL ? 'لا توجد إشعارات' : 'No notifications'}
          </Text>
          <Text style={[styles.emptySub, { color: C.textMuted }]}>
            {isRTL ? 'أنت محدّث!' : "You're all caught up!"}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {notifications.map((n) => (
            <NotifRow
              key={n.id}
              notif={n}
              C={C}
              isRTL={isRTL}
              onPress={handlePress}
              onMarkRead={markRead}
            />
          ))}
          <View style={{ height: Spacing.md }} />
        </ScrollView>
      )}
    </>
  );
}

// ─── Bell icon + badge ────────────────────────────────────────────────────────

export default function NotificationBell() {
  const C = useThemeColors();
  const isRTL = I18nManager.isRTL;
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  const shakeX = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -4, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -3, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 3, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 35, useNativeDriver: true }),
      ]).start();
      badgeScale.setValue(0.3);
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 18 }).start();
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  const badgeSide = isRTL ? styles.badgeRTL : styles.badgeLTR;

  return (
    <View style={styles.wrapper}>
      {/* Bell button */}
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
          <Bell size={20} color={C.textPrimary} strokeWidth={2} />
        </Animated.View>
        {unreadCount > 0 && (
          <Animated.View
            style={[
              styles.badge,
              badgeSide,
              { backgroundColor: C.error, transform: [{ scale: badgeScale }] },
            ]}
          >
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Panel — Modal works on both web and mobile, escapes all parent clipping */}
      <Modal
        visible={open}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {Platform.OS === 'web' ? (
          // Web: centred floating card with backdrop
          <View style={styles.webOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            <View
              style={[
                styles.webCard,
                {
                  backgroundColor: C.backgroundCard,
                  borderColor: C.border,
                  // Align to right edge on LTR, left edge on RTL
                  [isRTL ? 'left' : 'right']: 16,
                },
              ]}
            >
              <Panel onClose={() => setOpen(false)} C={C} isRTL={isRTL} />
            </View>
          </View>
        ) : (
          // Mobile: bottom sheet
          <View style={styles.mobileOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            <View
              style={[
                styles.mobileSheet,
                { backgroundColor: C.backgroundCard, borderColor: C.border },
              ]}
            >
              <SafeAreaView style={{ flex: 1, maxHeight: '100%' }}>
                <View style={[styles.handle, { backgroundColor: C.border }]} />
                <Panel onClose={() => setOpen(false)} C={C} isRTL={isRTL} />
              </SafeAreaView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeLTR: { right: 2 },
  badgeRTL: { left: 2 },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Web card ──
  webOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    // Panel anchored near top-right (or top-left for RTL) of screen
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'web' ? 64 : 80,
  },
  webCard: {
    position: 'absolute' as any,
    top: 64,
    width: 360,
    maxHeight: 480,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 24,
  },

  // ── Mobile sheet ──
  mobileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,10,20,0.75)',
    justifyContent: 'flex-end',
  },
  mobileSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '82%' as any,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },

  // ── Panel header ──
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  panelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  countChip: {
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  countChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  panelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },

  // ── Empty / loading ──
  centerState: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: FontSize.sm,
  },

  // ── Notification row ──
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 20,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  rowMessage: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  rowTime: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  checkBtn: {
    padding: 4,
    marginTop: 4,
    flexShrink: 0,
  },
});
