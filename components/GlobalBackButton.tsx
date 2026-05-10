import React, { useRef, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, Platform, Animated, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

// Screens where the back button should NOT appear.
// Includes both the full group path (native) and the bare path (web, where Expo Router
// strips route group prefixes from the URL).
const TAB_ROOTS = [
  '/',
  '/(tabs)',
  '/(tabs)/',
  '/(tabs)/index',
  '/(tabs)/cart',
  '/(tabs)/about',
  '/(tabs)/marketplace',
  '/(tabs)/account',
  '/(tabs)/wishlist',
  '/(tabs)/canopy',
  '/(tabs)/products',
  // bare paths used by Expo Router on web
  '/cart',
  '/about',
  '/marketplace',
  '/account',
  '/wishlist',
  '/canopy',
  '/products',
  '/reset-password',
];

// Screens that render their own back button — suppress the global one.
const SELF_MANAGED_BACK = [
  /^\/product\/[^/]+$/,
  /^\/marketplace\/[^/]+$/,
];

function isTabRoot(pathname: string): boolean {
  if (TAB_ROOTS.includes(pathname)) return true;
  // Admin screens have their own layout/shell with back navigation
  if (pathname.startsWith('/admin')) return true;
  return false;
}

export default function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => router.back());
  }, [router, scale]);

  if (isTabRoot(pathname)) return null;
  if (SELF_MANAGED_BACK.some((re) => re.test(pathname))) return null;

  const top = insets.top + (Platform.OS === 'ios' ? 8 : 12);

  return (
    <View
      style={[styles.wrapper, { top }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Animated.View
          style={[
            styles.btn,
            {
              backgroundColor: colors.background + 'E6',
              borderColor: colors.neonBlue + '99',
              shadowColor: colors.neonBlue,
            },
            { transform: [{ scale }] },
          ]}
        >
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    zIndex: 9999,
    // web needs explicit elevation for stacking
    ...(Platform.OS === 'web' ? { elevation: 9999 } : {}),
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
  },
});
