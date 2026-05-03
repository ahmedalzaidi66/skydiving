import React, { useRef, useCallback } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { House, ShoppingBag, Wind, User, Heart, Tag } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useGearWishlist } from '@/context/GearWishlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

const LOGO = require('../../assets/images/logo.png');

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  name: string;
  route: string;
  label: string;
  icon?: (active: boolean) => React.ReactNode;
  isCenter?: boolean;
  badgeCount?: () => number;
};

function getTabs(
  t: { navHome: string; navShop: string; navSaved: string; navAccount: string; navUsedGear: string },
  accent: string,
  inactive: string,
): TabDef[] {
  return [
    {
      name: 'index',
      route: '/(tabs)/',
      label: t.navHome,
      icon: (active) => (
        <House size={19} color={active ? accent : inactive} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
    {
      name: 'cart',
      route: '/(tabs)/cart',
      label: t.navShop,
      icon: (active) => (
        <ShoppingBag size={19} color={active ? accent : inactive} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
    {
      name: 'about',
      route: '/(tabs)/about',
      label: 'SKYDIVER',
      isCenter: true,
    },
    {
      name: 'marketplace',
      route: '/(tabs)/marketplace',
      label: t.navUsedGear,
      icon: (active) => (
        <Tag size={19} color={active ? accent : inactive} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
    {
      name: 'account',
      route: '/(tabs)/account',
      label: t.navAccount,
      icon: (active) => (
        <User size={19} color={active ? accent : inactive} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
  ];
}

// ─── Animated tab item ────────────────────────────────────────────────────────

function TabItem({
  tab,
  active,
  onPress,
  badge,
  accent,
  inactiveColor,
  bgColor,
}: {
  tab: TabDef;
  active: boolean;
  onPress: () => void;
  badge?: number;
  accent: string;
  inactiveColor: string;
  bgColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.82,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 14,
      }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <Pressable
      style={styles.tabItem}
      onPress={handlePress}
      android_ripple={null}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale }] }]}>
        <View style={{ position: 'relative' }}>
          {tab.icon && tab.icon(active)}
          {badge != null && badge > 0 && (
            <View style={[styles.tabBadge, { borderColor: bgColor }]}>
              <Text style={styles.tabBadgeText}>
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.tabLabel, { color: active ? accent : inactiveColor }, active && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
        <View style={[styles.activeDot, active && [styles.activeDotVisible, { backgroundColor: accent, shadowColor: accent }]]} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Center logo button ───────────────────────────────────────────────────────

function CenterTabItem({ active, onPress, accent, bgColor }: { active: boolean; onPress: () => void; accent: string; bgColor: string; inactiveColor: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(active ? 1 : 0.4)).current;

  React.useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: active ? 1 : 0.4,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [active, glowAnim]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.88,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 18,
      }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <Pressable
      style={styles.centerTabItem}
      onPress={handlePress}
      android_ripple={null}
    >
      {/* Outer glow ring — animated opacity */}
      <Animated.View
        style={[
          styles.centerGlowRing,
          { opacity: glowAnim, borderColor: accent + '80', backgroundColor: accent + '0F', shadowColor: accent },
        ]}
      />
      {/* Logo button */}
      <Animated.View
        style={[
          styles.centerButton,
          { backgroundColor: bgColor, borderColor: active ? accent : accent + '59', shadowColor: accent },
          active && styles.centerButtonActive,
          { transform: [{ scale }] },
        ]}
      >
        <Image source={LOGO} style={styles.centerImage} resizeMode="contain" />
      </Animated.View>
      {/* Label below */}
      <Text style={[styles.centerLabel, { color: active ? accent : undefined }, active && styles.centerLabelActive]}>
        SKYDIVER
      </Text>
    </Pressable>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { count: wishlistCount } = useWishlist();
  const { count: gearWishlistCount } = useGearWishlist();
  const totalFavCount = wishlistCount + gearWishlistCount;
  const { t } = useLanguage();
  const { colors } = useTheme();
  const inactive = colors.textMuted;
  const TABS = getTabs(t, colors.neonBlue, inactive);

  const isActive = useCallback(
    (tab: TabDef) => {
      if (tab.name === 'index') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
      return pathname.startsWith(`/(tabs)/${tab.name}`);
    },
    [pathname],
  );

  const navigate = useCallback(
    (tab: TabDef) => {
      router.push(tab.route as any);
    },
    [router],
  );

  const barPaddingBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 6);

  return (
    <View style={[styles.barWrapper, { paddingBottom: barPaddingBottom }]}>
      {/* Theme-aware background */}
      <View style={[styles.barBg, { backgroundColor: colors.tabBar }]} />
      {/* Glowing top border */}
      <View style={[styles.barTopBorder, { backgroundColor: colors.neonBlue }]} />

      <View style={styles.barInner}>
        {TABS.map((tab) => {
          const active = isActive(tab);
          if (tab.isCenter) {
            return (
              <CenterTabItem
                key={tab.name}
                active={active}
                onPress={() => navigate(tab)}
                accent={colors.neonBlue}
                bgColor={colors.tabBar as string}
                inactiveColor={inactive}
              />
            );
          }
          return (
            <TabItem
              key={tab.name}
              tab={tab}
              active={active}
              onPress={() => navigate(tab)}
              badge={tab.name === 'wishlist' ? totalFavCount : undefined}
              accent={colors.neonBlue}
              inactiveColor={inactive}
              bgColor={colors.tabBar as string}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="about" />
      <Tabs.Screen name="canopy" />
      <Tabs.Screen name="wishlist" />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="marketplace" />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Bar shell ──────────────────────────────────────────────────────────────
  barWrapper: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#060C18',
  },
  barTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,191,255,0.55)',
    // Glow effect via shadow (iOS/web)
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 0,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 5,
  },

  // ── Regular tab item ───────────────────────────────────────────────────────
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    minHeight: 48,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#3D6880',
    letterSpacing: 0.3,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 12,
  },
  tabLabelActive: {
    color: '#00BFFF',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  activeDotVisible: {
    backgroundColor: '#00BFFF',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF4D6D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#060C18',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },

  // ── Center tab ────────────────────────────────────────────────────────────
  centerTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    minHeight: 60,
  },
  centerGlowRing: {
    position: 'absolute',
    top: -14,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.5)',
    backgroundColor: 'rgba(0,191,255,0.06)',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 0,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#060C18',
    borderWidth: 2,
    borderColor: 'rgba(0,191,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: -18,
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  centerButtonActive: {
    borderColor: '#00BFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  centerImage: {
    width: 46,
    height: 46,
  },
  centerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#3D6880',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
    includeFontPadding: false,
    lineHeight: 11,
  },
  centerLabelActive: {
    color: '#00BFFF',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
