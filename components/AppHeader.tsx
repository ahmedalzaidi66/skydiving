import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Menu, User, ShoppingCart, ChevronLeft, ChevronRight, Heart } from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCMS } from '@/context/CMSContext';
import { useWishlist } from '@/context/WishlistContext';
import { useGearWishlist } from '@/context/GearWishlistContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NavigationDrawer from '@/components/NavigationDrawer';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import { useUISize } from '@/context/UISizeContext';
import { useTheme } from '@/context/ThemeContext';

const LOGO = require('../assets/images/logo.png');

type Props = {
  showBack?: boolean;
  title?: string;
};

export default function AppHeader({ showBack = false, title }: Props) {
  const router = useRouter();
  const { totalItems } = useCart();
  const { isRTL } = useLanguage();
  const { branding } = useCMS();
  const { count: productWishlistCount } = useWishlist();
  const { count: gearWishlistCount } = useGearWishlist();
  const wishlistCount = productWishlistCount + gearWishlistCount;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { headerSizes } = useUISize();
  const { colors } = useTheme();
  const backScale = useRef(new Animated.Value(1)).current;

  const handleBackPress = () => {
    Animated.sequence([
      Animated.timing(backScale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      Animated.timing(backScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => router.back());
  };

  const showIcons = branding.header_icons !== 'false';

  const heartScale = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(wishlistCount);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = wishlistCount;

    if (wishlistCount > prev) {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 0 }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 20 }),
      ]).start();

      badgeScale.setValue(0);
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 20 }).start();
    } else if (wishlistCount < prev && wishlistCount === 0) {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 0.8, useNativeDriver: true, speed: 40, bounciness: 0 }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
      ]).start();
    }
  }, [wishlistCount]);

  // Back arrow direction: visually points "backward" for the reading direction.
  // LTR → ChevronLeft, RTL → ChevronRight (both visually point toward the start).
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <>
      <View style={[styles.container, { minHeight: headerSizes.headerHeight, backgroundColor: colors.background, borderBottomColor: colors.border }]}>

        {/* For RTL: trailing icons render first (physical left = visual right in RTL) */}
        {isRTL && (
          <View style={[styles.trailingSlot, styles.trailingSlotRTL]}>
            <LanguageSwitcher />
            {showIcons && (
              <>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/account')}>
                  <User size={22} color={colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/wishlist')}>
                  <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                    <Heart size={22} color={wishlistCount > 0 ? '#FF4D6D' : colors.textPrimary} fill={wishlistCount > 0 ? '#FF4D6D' : 'transparent'} strokeWidth={2} />
                  </Animated.View>
                  {wishlistCount > 0 && (
                    <Animated.View style={[styles.badge, styles.wishlistBadge, styles.badgeRTL, { transform: [{ scale: badgeScale }] }]}>
                      <Text style={styles.badgeText}>{wishlistCount > 99 ? '99+' : wishlistCount}</Text>
                    </Animated.View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/cart')}>
                  <ShoppingCart size={22} color={colors.textPrimary} strokeWidth={2} />
                  {totalItems > 0 && (
                    <View style={[styles.badge, styles.badgeRTL]}>
                      <Text style={styles.badgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Center: logo / title */}
        <TouchableOpacity
          style={styles.logoContainer}
          onPress={() => router.push('/')}
          activeOpacity={title ? 1 : 0.75}
          disabled={!!title}
        >
          {title ? (
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{title}</Text>
          ) : branding.logo_url ? (
            <Image source={{ uri: branding.logo_url }} style={styles.logoImage} resizeMode="contain" />
          ) : (branding.app_name || branding.app_tagline) ? (
            <View style={styles.brandTextWrap}>
              {branding.app_name ? <Text style={[styles.brandName, { color: colors.textPrimary }]}>{branding.app_name}</Text> : null}
              {branding.app_tagline ? <Text style={[styles.brandTagline, { color: colors.neonBlue }]}>{branding.app_tagline}</Text> : null}
            </View>
          ) : (
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          )}
        </TouchableOpacity>

        {/* For LTR: trailing icons on the right */}
        {!isRTL && (
          <View style={styles.trailingSlot}>
            <LanguageSwitcher />
            {showIcons && (
              <>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/account')}>
                  <User size={22} color={colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/wishlist')}>
                  <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                    <Heart size={22} color={wishlistCount > 0 ? '#FF4D6D' : colors.textPrimary} fill={wishlistCount > 0 ? '#FF4D6D' : 'transparent'} strokeWidth={2} />
                  </Animated.View>
                  {wishlistCount > 0 && (
                    <Animated.View style={[styles.badge, styles.wishlistBadge, styles.badgeLTR, { transform: [{ scale: badgeScale }] }]}>
                      <Text style={styles.badgeText}>{wishlistCount > 99 ? '99+' : wishlistCount}</Text>
                    </Animated.View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => router.push('/(tabs)/cart')}>
                  <ShoppingCart size={22} color={colors.textPrimary} strokeWidth={2} />
                  {totalItems > 0 && (
                    <View style={[styles.badge, styles.badgeLTR]}>
                      <Text style={styles.badgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Back button OR hamburger — absolutely positioned on the visual leading edge */}
        <View style={[styles.backSlot, isRTL ? styles.backSlotRTL : styles.backSlotLTR]}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBackPress}
              activeOpacity={1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View style={[styles.backBtn, { borderColor: colors.neonBlue + '8C', shadowColor: colors.neonBlue, backgroundColor: colors.background }, { transform: [{ scale: backScale }] }]}>
                <BackIcon size={20} color={colors.textPrimary} strokeWidth={2.5} />
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => setDrawerOpen(true)}>
              <Menu size={22} color={colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <NavigationDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 52 : 18,
    paddingBottom: 10,
    backgroundColor: '#050A14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,191,255,0.12)',
  },
  // Back/menu button: absolutely positioned so it never pushes or overlaps the center/trailing
  backSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 18,
  },
  backSlotLTR: {
    left: 14,
  },
  backSlotRTL: {
    right: 14,
  },
  // Trailing slot: action icons grouped on the visual trailing edge
  trailingSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailingSlotRTL: {
    flexDirection: 'row-reverse',
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,191,255,0.55)',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Reserve space on both sides so title can't slip under the absolute back/menu button
    paddingHorizontal: 62,
  },
  logoImage: {
    height: 44,
    width: 120,
  },
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandTextWrap: {
    alignItems: 'center',
  },
  brandName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    lineHeight: 18,
  },
  brandTagline: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  badge: {
    position: 'absolute',
    top: 2,
    backgroundColor: '#FF4444',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  wishlistBadge: {
    backgroundColor: '#FF4D6D',
  },
  badgeLTR: {
    right: 2,
  },
  badgeRTL: {
    left: 2,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
