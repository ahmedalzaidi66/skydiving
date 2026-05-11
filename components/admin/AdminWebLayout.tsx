import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import {
  LayoutDashboard,
  Package,
  Layers2,
  ShoppingCart,
  Users,
  UserCog,
  File as FileEdit,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  Tag,
  Layers,
  LayoutGrid,
  Maximize2,
  Globe,
  ShieldAlert,
  Info,
  Megaphone,
  Truck,
  Flag,
} from 'lucide-react-native';
import { useAdmin, ROLE_LABELS } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const WEB_ONLY_ROUTES = new Set(['/admin/builder', '/admin/layout', '/admin/sizes']);

// Each nav item declares which permission key unlocks it.
// Items with no `permission` are always visible (login/index).
const NAV_ITEMS = [
  { key: 'dashboard',     icon: LayoutDashboard, tab: 'dashboard',   permission: 'view_dashboard',    webOnly: false },
  { key: 'products',      icon: Package,         tab: 'products',    permission: 'manage_products',   webOnly: false },
  { key: 'categories',    icon: Layers2,         tab: 'categories',  permission: 'manage_products',   webOnly: false },
  { key: 'ordersAdmin',   icon: ShoppingCart,    tab: 'orders',      permission: 'manage_orders',     webOnly: false },
  { key: 'customers',     icon: Users,           tab: 'customers',   permission: 'manage_customers',  webOnly: false },
  { key: 'employees',     icon: UserCog,         tab: 'employees',   permission: 'manage_employees',  webOnly: false },
  { key: 'reviews',       icon: MessageSquare,   tab: 'reviews',     permission: 'manage_reviews',    webOnly: false },
  { key: 'coupons',       icon: Tag,             tab: 'coupons',     permission: 'manage_coupons',    webOnly: false },
  { key: 'content',       icon: FileEdit,        tab: 'content',     permission: 'manage_cms',        webOnly: false },
  { key: 'homeSections',  icon: Layers2,         tab: 'sections',    permission: 'manage_cms',        webOnly: false },
  { key: 'adminAbout',    icon: Info,            tab: 'about',       permission: 'manage_cms',        webOnly: false },
  { key: 'pageBuilder',   icon: Layers,          tab: 'builder',     permission: 'manage_cms',        webOnly: true  },
  { key: 'layoutSpacing', icon: LayoutGrid,      tab: 'layout',      permission: 'manage_layout',     webOnly: true  },
  { key: 'uiSizes',       icon: Maximize2,       tab: 'sizes',       permission: 'manage_layout',     webOnly: true  },
  { key: 'adminMarketplace', icon: Tag,          tab: 'marketplace', permission: 'manage_orders',     webOnly: false },
  { key: 'campaigns',     icon: Megaphone,       tab: 'campaigns',   permission: 'manage_customers',  webOnly: false },
  { key: 'gearReports',   icon: Flag,            tab: 'gear-reports', permission: 'manage_orders',    webOnly: false },
  { key: 'shippingTax',   icon: Truck,           tab: 'shipping',    permission: 'manage_settings',   webOnly: false },
  { key: 'settings',      icon: Settings,        tab: 'settings',    permission: 'manage_settings',   webOnly: false },
  { key: 'permissions',   icon: ShieldAlert,     tab: 'permissions', permission: 'manage_permissions',webOnly: false },
] as const;

// Role badge colour map
const ROLE_COLORS: Record<string, string> = {
  super_admin:      Colors.gold,
  admin:            Colors.gold,
  employee:         Colors.neonBlue,
  product_manager:  '#A78BFA',
  order_manager:    Colors.success,
  customer_support: Colors.warning,
  content_editor:   '#60CDFF',
};

type Props = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** When true, children fill the remaining height directly instead of being wrapped in a ScrollView */
  noScroll?: boolean;
};

export default function AdminWebLayout({ children, title, noScroll = false }: Props) {
  const router = useRouter();
  const { tab: activeTab } = useLocalSearchParams<{ tab?: string }>();
  const { admin, adminLogout } = useAdmin();
  const { hasPermission } = usePermissions();
  const { t } = useLanguage();

  const handleLogout = () => {
    adminLogout();
    router.replace('/admin/login');
  };

  const roleKey = admin?.role ?? '';
  const roleLabel = ROLE_LABELS[roleKey] ?? roleKey.replace(/_/g, ' ');
  const roleBadgeColor = ROLE_COLORS[roleKey] ?? Colors.textMuted;

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  return (
    <View style={styles.layout}>
      {/* ── Permanent sidebar ── */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <View style={styles.logoRow}>
            <ShieldCheck size={22} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.logoText}>Admin</Text>
          </View>
          <Text style={styles.storeName}>Skydiver Man Gear</Text>
        </View>

        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = (activeTab ?? 'dashboard') === item.tab;
            return (
              <TouchableOpacity
                key={item.tab}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(`/admin/panel?tab=${item.tab}` as any)}
                activeOpacity={0.7}
              >
                <Icon size={18} color={active ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {(t as any)[item.key] ?? item.key}
                </Text>
                {item.webOnly && !active && (
                  <View style={styles.webDot}>
                    <Globe size={8} color={Colors.neonBlue} strokeWidth={2.5} />
                  </View>
                )}
                {active && <View style={styles.activeBar} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sidebarFooter}>
          <View style={styles.adminInfo}>
            <View style={[styles.adminAvatar, { backgroundColor: roleBadgeColor }]}>
              <Text style={styles.adminAvatarText}>{admin?.name?.[0] ?? 'A'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminName} numberOfLines={1}>{admin?.name}</Text>
              {/* Role badge */}
              <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor + '55' }]}>
                <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>{roleLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.langRow}>
            <LanguageSwitcher />
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={16} color={Colors.error} strokeWidth={2} />
            <Text style={styles.logoutText}>{t.signOut}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main content ── */}
      <View style={styles.mainContent}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>{title}</Text>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.storeLink}>
            <Text style={styles.storeLinkText}>{t.viewStore}</Text>
            <ChevronRight size={14} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        {noScroll ? (
          <View style={styles.contentFlex}>
            {children}
          </View>
        ) : (
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    width: 240,
    backgroundColor: Colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: Spacing.xl,
  },
  sidebarHeader: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logoText: {
    color: Colors.neonBlue,
    fontSize: FontSize.lg,
    fontWeight: '800',
    letterSpacing: 1,
  },
  storeName: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  navList: {
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: Colors.neonBlueGlow,
  },
  navLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  navLabelActive: {
    color: Colors.neonBlue,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: Colors.neonBlue,
    borderRadius: 2,
  },
  webDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Spacing.md,
  },
  adminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminAvatarText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  adminName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 3,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  langRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  logoutText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  storeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeLinkText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
    padding: Spacing.xl,
  },
  contentFlex: {
    flex: 1,
    overflow: 'hidden',
  },
});
