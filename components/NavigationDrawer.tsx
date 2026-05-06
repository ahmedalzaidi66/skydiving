import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
  Platform, SafeAreaView, ScrollView, Animated, I18nManager,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  House, ShoppingCart, User, Wind, ShieldCheck, X, ShoppingBag,
  ChevronDown, Package, HardHat, Wrench, Clock, Shirt, Tag, Info, ChevronRight,
} from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { useCMS } from '@/context/CMSContext';
import { useLanguage } from '@/context/LanguageContext';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, FontSize, Radius } from '@/constants/theme';
import { supabase, fetchCategories, getCategoryName, Category } from '@/lib/supabase';

type CategoryWithCount = Category & { product_count: number };
type Props = { visible: boolean; onClose: () => void };

function CategoryIcon({ slug, size, color }: { slug: string; size: number; color: string }) {
  const props = { size, color, strokeWidth: 1.8 };
  if (slug === 'helmets') return <HardHat {...props} />;
  if (slug === 'suits') return <Shirt {...props} />;
  if (slug === 'accessories') return <Wrench {...props} />;
  if (slug === 'altimeters') return <Clock {...props} />;
  if (slug === 'parachutes' || slug === 'canopies') return <Wind {...props} />;
  return <Tag {...props} />;
}

function getMainNav(t: { navHome: string; navCanopyFinder: string; navAccount: string; navAbout: string; navUsedGear: string }) {
  return [
    { label: t.navHome, icon: House, route: '/(tabs)/' },
    { label: t.navUsedGear, icon: Tag, route: '/(tabs)/marketplace' },
    { label: t.navCanopyFinder, icon: Wind, route: '/(tabs)/canopy' },
    { label: t.navAccount, icon: User, route: '/(tabs)/account' },
    { label: t.navAbout, icon: Info, route: '/(tabs)/about' },
  ];
}

function Accordion({ expanded, maxHeight, children }: { expanded: boolean; maxHeight: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: expanded ? 1 : 0, duration: 260, useNativeDriver: false }).start();
  }, [expanded]);
  return (
    <Animated.View style={{ height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, maxHeight] }), overflow: 'hidden', opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.8, 1] }) }}>
      {children}
    </Animated.View>
  );
}

export default function NavigationDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const Colors = useThemeColors();
  const { totalItems } = useCart();
  const { branding } = useCMS();
  const { language, t } = useLanguage();
  const isRTL = I18nManager.isRTL;
  const MAIN_NAV = getMainNav(t);

  const [productsOpen, setProductsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const chevronAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function load() {
      const [cats, { data: countRows }] = await Promise.all([
        fetchCategories(language),
        supabase.from('products').select('category').eq('status', 'active'),
      ]);
      const countMap: Record<string, number> = {};
      for (const row of (countRows ?? []) as { category: string }[]) {
        countMap[row.category] = (countMap[row.category] ?? 0) + 1;
      }
      setCategories(cats.map(c => ({ ...c, product_count: countMap[c.slug] ?? 0 })));
    }
    load();
  }, [language]);

  useEffect(() => {
    Animated.timing(chevronAnim, { toValue: productsOpen ? 1 : 0, duration: 240, useNativeDriver: true }).start();
  }, [productsOpen]);

  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: isRTL ? ['0deg', '-180deg'] : ['0deg', '180deg'] });

  const handleNav = useCallback((route: string) => {
    onClose();
    setSelectedCategory(null);
    setTimeout(() => router.push(route as any), 55);
  }, [onClose, router]);

  const handleAllProducts = useCallback(() => {
    onClose(); setSelectedCategory(null); setProductsOpen(false);
    setTimeout(() => router.push('/(tabs)/products' as any), 55);
  }, [onClose, router]);

  const handleCategory = useCallback((slug: string) => {
    onClose(); setSelectedCategory(slug); setProductsOpen(false);
    setTimeout(() => router.push({ pathname: '/(tabs)/products', params: { category: slug } } as any), 55);
  }, [onClose, router]);

  const isRouteActive = useCallback((route: string) => {
    const bare = route.replace('/(tabs)/', '').replace('/(tabs)', '');
    if (bare === '/' || bare === '') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
    return pathname.includes(bare);
  }, [pathname]);

  const isProductsActive = pathname.includes('products');
  const accordionMaxH = 54 + categories.length * 52 + 8;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.overlay, isRTL && styles.overlayRTL]} onPress={onClose}>
        <Pressable
          style={[styles.drawer, isRTL && styles.drawerRTL, { backgroundColor: Colors.backgroundSecondary, borderRightColor: Colors.border, borderLeftColor: Colors.border }]}
          onPress={e => e.stopPropagation()}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={[styles.header, isRTL && styles.headerRTL]}>
              <View>
                <Text style={[styles.brandName, { color: Colors.textPrimary }]}>{branding.app_name || 'SKYDIVER'}</Text>
                <Text style={[styles.brandTagline, { color: Colors.neonBlue }]}>{branding.app_tagline || 'MAN GEAR'}</Text>
              </View>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: Colors.borderLight }]} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={Colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={[styles.divider, { backgroundColor: Colors.border }]} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
              {MAIN_NAV.slice(0, 1).map(({ label, icon: Icon, route }) => {
                const active = isRouteActive(route);
                return (
                  <NavRow key={route} label={label} icon={<Icon size={20} color={active ? Colors.neonBlue : Colors.textSecondary} strokeWidth={2} />}
                    active={active} isRTL={isRTL} Colors={Colors} onPress={() => handleNav(route)} />
                );
              })}

              {/* Products accordion trigger */}
              <TouchableOpacity
                style={[styles.navRow, isRTL && styles.navRowRTL, { backgroundColor: (isProductsActive || productsOpen) ? Colors.neonBlueGlow : 'transparent' }]}
                onPress={() => setProductsOpen(v => !v)}
                activeOpacity={0.75}
              >
                {(isProductsActive || productsOpen) && <View style={[styles.activeBar, isRTL && styles.activeBarRTL, { backgroundColor: Colors.neonBlue }]} />}
                <ShoppingBag size={20} color={(isProductsActive || productsOpen) ? Colors.neonBlue : Colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.navLabel, (isProductsActive || productsOpen) && styles.navLabelActive, { color: (isProductsActive || productsOpen) ? Colors.textPrimary : Colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.navProducts}
                </Text>
                <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                  <ChevronDown size={16} color={(isProductsActive || productsOpen) ? Colors.neonBlue : Colors.textMuted} strokeWidth={2.5} />
                </Animated.View>
              </TouchableOpacity>

              <Accordion expanded={productsOpen} maxHeight={accordionMaxH}>
                <View style={[styles.accordionBody, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
                  <TouchableOpacity
                    style={[styles.categoryRow, isRTL && styles.categoryRowRTL, { borderBottomColor: Colors.borderLight, backgroundColor: (!selectedCategory && isProductsActive) ? Colors.neonBlueGlow : 'transparent' }]}
                    onPress={handleAllProducts}
                    activeOpacity={0.75}
                  >
                    <Package size={16} color={!selectedCategory && isProductsActive ? Colors.neonBlue : Colors.textSecondary} strokeWidth={1.8} />
                    <Text style={[styles.categoryLabel, { color: !selectedCategory && isProductsActive ? Colors.neonBlue : Colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                      {t.navAllProducts}
                    </Text>
                    <ChevronRight size={13} color={Colors.textMuted} strokeWidth={2} style={{ transform: isRTL ? [{ scaleX: -1 }] : [] }} />
                  </TouchableOpacity>

                  {categories.map(cat => {
                    const catActive = selectedCategory === cat.slug && isProductsActive;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryRow, isRTL && styles.categoryRowRTL, { borderBottomColor: Colors.borderLight, backgroundColor: catActive ? Colors.neonBlueGlow : 'transparent' }]}
                        onPress={() => handleCategory(cat.slug)}
                        activeOpacity={0.75}
                      >
                        <CategoryIcon slug={cat.slug} size={16} color={catActive ? Colors.neonBlue : Colors.textSecondary} />
                        <Text style={[styles.categoryLabel, { color: catActive ? Colors.neonBlue : Colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                          {getCategoryName(cat, language)}
                        </Text>
                        {cat.product_count > 0 && (
                          <View style={[styles.countBadge, { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder }]}>
                            <Text style={[styles.countText, { color: Colors.neonBlue }]}>{cat.product_count}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Accordion>

              {MAIN_NAV.slice(1).map(({ label, icon: Icon, route }) => {
                const active = isRouteActive(route);
                return (
                  <NavRow key={route} label={label} icon={<Icon size={20} color={active ? Colors.neonBlue : Colors.textSecondary} strokeWidth={2} />}
                    active={active} isRTL={isRTL} Colors={Colors} onPress={() => handleNav(route)} />
                );
              })}

              <NavRow
                label={t.navCart}
                icon={
                  <View style={{ position: 'relative' }}>
                    <ShoppingCart size={20} color={isRouteActive('/(tabs)/cart') ? Colors.neonBlue : Colors.textSecondary} strokeWidth={2} />
                    {totalItems > 0 && (
                      <View style={[styles.cartBadge, { backgroundColor: Colors.neonBlue }]}>
                        <Text style={[styles.cartBadgeText, { color: Colors.background }]}>{totalItems > 99 ? '99+' : totalItems}</Text>
                      </View>
                    )}
                  </View>
                }
                active={isRouteActive('/(tabs)/cart')}
                isRTL={isRTL}
                Colors={Colors}
                onPress={() => handleNav('/(tabs)/cart')}
              />

              <View style={[styles.divider, { backgroundColor: Colors.border }]} />

              <TouchableOpacity
                style={[styles.adminBtn, isRTL && styles.adminBtnRTL, { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder }]}
                onPress={() => handleNav('/admin')}
                activeOpacity={0.75}
              >
                <ShieldCheck size={18} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={[styles.adminLabel, { color: Colors.neonBlue }]}>{t.navAdminPanel}</Text>
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NavRow({ label, icon, active, isRTL, Colors, onPress }: { label: string; icon: React.ReactNode; active: boolean; isRTL: boolean; Colors: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.navRow, active && styles.navRowActive, isRTL && styles.navRowRTL, { backgroundColor: active ? Colors.neonBlueGlow : 'transparent' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {active && <View style={[styles.activeBar, isRTL && styles.activeBarRTL, { backgroundColor: Colors.neonBlue }]} />}
      {icon}
      <Text style={[styles.navLabel, active && styles.navLabelActive, { color: active ? Colors.textPrimary : Colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row' },
  overlayRTL: { flexDirection: 'row-reverse' },
  drawer: { width: 280, borderRightWidth: 1, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20 },
  drawerRTL: { borderRightWidth: 0, borderLeftWidth: 1, shadowOffset: { width: -4, height: 0 } },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? Spacing.xl : 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerRTL: { flexDirection: 'row-reverse' },
  brandName: { fontSize: FontSize.lg, fontWeight: '900', letterSpacing: 2.5 },
  brandTagline: { fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 2.5, marginTop: 1 },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.full },
  divider: { height: 1, marginHorizontal: Spacing.md, marginVertical: Spacing.sm },
  scroll: { flex: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.md, paddingVertical: 15, marginHorizontal: Spacing.sm, marginVertical: 1, borderRadius: Radius.md, position: 'relative' },
  navRowRTL: { flexDirection: 'row-reverse' },
  navRowActive: {},
  activeBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  activeBarRTL: { left: undefined, right: 0 },
  navLabel: { fontSize: FontSize.md, fontWeight: '600' },
  navLabelActive: { fontWeight: '700' },
  accordionBody: { marginHorizontal: Spacing.sm, marginBottom: 4, borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  categoryRowRTL: { flexDirection: 'row-reverse' },
  categoryLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  countBadge: { minWidth: 22, height: 22, borderRadius: Radius.full, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  countText: { fontSize: 10, fontWeight: '700' },
  cartBadge: { position: 'absolute', top: -5, right: -8, borderRadius: 999, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  cartBadgeText: { fontSize: 9, fontWeight: '800' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14, marginHorizontal: Spacing.sm, marginTop: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  adminBtnRTL: { flexDirection: 'row-reverse' },
  adminLabel: { fontSize: FontSize.md, fontWeight: '700' },
});
