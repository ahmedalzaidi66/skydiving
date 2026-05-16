import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Platform, Modal, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { Bell, X, Check, CheckCheck, ShoppingBag, Tag, Heart, Megaphone, FileText, Package, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotifications, type AppNotification, type NotificationType } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(type: NotificationType, color: string) {
  const props = { size: 16, color, strokeWidth: 2 };
  switch (type) {
    case 'order_update':   return <ShoppingBag {...props} />;
    case 'gear_approved':  return <Tag {...props} />;
    case 'gear_rejected':  return <Tag {...props} />;
    case 'price_drop':     return <Heart {...props} />;
    case 'announcement':   return <Megaphone {...props} />;
    case 'report_update':  return <FileText {...props} />;
    case 'campaign':       return <Package {...props} />;
    default:               return <Info {...props} />;
  }
}

function typeColor(type: NotificationType, Colors: any): string {
  switch (type) {
    case 'order_update':   return Colors.neonBlue;
    case 'gear_approved':  return Colors.success;
    case 'gear_rejected':  return Colors.error;
    case 'price_drop':     return '#FF4D6D';
    case 'announcement':   return Colors.warning;
    case 'report_update':  return Colors.neonBlue;
    case 'campaign':       return Colors.warning;
    default:               return Colors.textMuted;
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
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif, Colors, onPress, onMarkRead,
}: {
  notif: AppNotification;
  Colors: any;
  onPress: (n: AppNotification) => void;
  onMarkRead: (id: string) => void;
}) {
  const color = typeColor(notif.type, Colors);
  return (
    <TouchableOpacity
      style={[
        styles.notifRow,
        { borderBottomColor: Colors.borderLight, backgroundColor: notif.read ? 'transparent' : Colors.neonBlueGlow },
      ]}
      onPress={() => onPress(notif)}
      activeOpacity={0.75}
    >
      {/* Unread dot */}
      {!notif.read && (
        <View style={[styles.unreadDot, { backgroundColor: Colors.neonBlue }]} />
      )}

      {/* Icon */}
      <View style={[styles.notifIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        {typeIcon(notif.type, color)}
      </View>

      {/* Content */}
      <View style={styles.notifBody}>
        <Text style={[styles.notifTitle, { color: Colors.textPrimary }]} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={[styles.notifMessage, { color: Colors.textSecondary }]} numberOfLines={2}>
          {notif.message}
        </Text>
        <Text style={[styles.notifTime, { color: Colors.textMuted }]}>
          {relativeTime(notif.created_at)}
        </Text>
      </View>

      {/* Mark-read tap */}
      {!notif.read && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.checkBtn}
        >
          <Check size={14} color={Colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Panel content (shared web+mobile) ───────────────────────────────────────

function PanelContent({
  onClose, Colors,
}: {
  onClose: () => void;
  Colors: any;
}) {
  const router = useRouter();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

  const handlePress = useCallback((n: AppNotification) => {
    if (!n.read) markRead(n.id);
    onClose();
    if (n.link) {
      setTimeout(() => router.push(n.link as any), 80);
    }
  }, [markRead, onClose, router]);

  return (
    <>
      {/* Header */}
      <View style={[styles.panelHeader, { borderBottomColor: Colors.border }]}>
        <View style={styles.panelHeaderLeft}>
          <Text style={[styles.panelTitle, { color: Colors.textPrimary }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: Colors.neonBlue }]}>
              <Text style={[styles.unreadBadgeText, { color: Colors.background }]}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.panelHeaderRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
              <CheckCheck size={14} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={[styles.markAllText, { color: Colors.neonBlue }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
            <X size={18} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.neonBlue} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerState}>
          <Bell size={32} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: Colors.textSecondary }]}>No notifications</Text>
          <Text style={[styles.emptySubtitle, { color: Colors.textMuted }]}>
            You're all caught up!
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
        >
          {notifications.map((n) => (
            <NotifRow
              key={n.id}
              notif={n}
              Colors={Colors}
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

// ─── Main bell component ──────────────────────────────────────────────────────

export default function NotificationBell() {
  const Colors = useThemeColors();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  // Shake animation on new notification
  const shakeX = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      // Shake bell
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -3, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 3, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
      // Pop badge
      badgeScale.setValue(0.4);
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 18 }).start();
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={toggle}>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <Bell size={20} color={Colors.textPrimary} strokeWidth={2} />
          </Animated.View>
          {unreadCount > 0 && (
            <Animated.View style={[styles.badge, styles.badgeLTR, { backgroundColor: Colors.error, transform: [{ scale: badgeScale }] }]}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>

        {open && (
          <>
            {/* Click-away */}
            <Pressable style={styles.webBackdrop as any} onPress={close} />
            {/* Dropdown panel */}
            <View style={[styles.webPanel, { backgroundColor: Colors.backgroundCard, borderColor: Colors.border }]}>
              <PanelContent onClose={close} Colors={Colors} />
            </View>
          </>
        )}
      </View>
    );
  }

  // Mobile: bottom sheet modal
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={toggle}>
        <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
          <Bell size={20} color={Colors.textPrimary} strokeWidth={2} />
        </Animated.View>
        {unreadCount > 0 && (
          <Animated.View style={[styles.badge, styles.badgeLTR, { backgroundColor: Colors.error, transform: [{ scale: badgeScale }] }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.mobileBackdrop}>
          <Pressable style={StyleSheet.absoluteFill as any} onPress={close} />
          <View style={[styles.mobileSheet, { backgroundColor: Colors.backgroundCard, borderColor: Colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: Colors.border }]} />
            <PanelContent onClose={close} Colors={Colors} />
          </View>
        </View>
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
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Web dropdown ──
  webBackdrop: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
  },
  webPanel: {
    position: 'absolute' as any,
    top: '100%',
    right: 0,
    width: 360,
    maxHeight: 480,
    zIndex: 1000,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
  },

  // ── Mobile sheet ──
  mobileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,20,0.75)',
    justifyContent: 'flex-end',
  },
  mobileSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: 300,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // ── Panel ──
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  unreadBadge: {
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 2,
  },

  // ── List ──
  list: { flex: 1 },
  centerState: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
  },

  // ── Row ──
  notifRow: {
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
    left: 4,
    top: 20,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  notifBody: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  notifMessage: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  checkBtn: {
    padding: 4,
    marginTop: 4,
  },
});
