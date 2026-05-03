import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, ShoppingCart, Trash2, X, MessageCircle, Tag } from 'lucide-react-native';
import { useWishlist, WishlistItem } from '@/context/WishlistContext';
import { useGearWishlist, GearWishlistItem } from '@/context/GearWishlistContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getProductName, getProductImage } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

const PAGE_SIZE = 10;

type ListRow =
  | { kind: 'product'; item: WishlistItem }
  | { kind: 'gear'; item: GearWishlistItem }
  | { kind: 'divider' }
  | { kind: 'footer' };

export default function WishlistScreen() {
  const { isAuthenticated } = useAuth();
  const { wishlistItems, loading, remove, clearAll, count } = useWishlist();
  const { gearWishlistItems, loading: gearLoading, removeGear, count: gearCount } = useGearWishlist();
  const { addToCart, items: cartItems } = useCart();
  const { t, language } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const totalCount = count + gearCount;

  // Track how many combined rows are visible
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadingMoreRef = useRef(false);

  const allRows = useMemo((): ListRow[] => {
    const rows: ListRow[] = [];
    for (const item of wishlistItems) rows.push({ kind: 'product', item });
    if (gearWishlistItems.length > 0) {
      if (wishlistItems.length > 0) rows.push({ kind: 'divider' });
      for (const item of gearWishlistItems) rows.push({ kind: 'gear', item });
    }
    rows.push({ kind: 'footer' });
    return rows;
  }, [wishlistItems, gearWishlistItems]);

  const visibleRows = useMemo(() => {
    const dataRows = allRows.filter((r) => r.kind !== 'footer');
    const sliced = dataRows.slice(0, visibleCount);
    sliced.push({ kind: 'footer' });
    return sliced;
  }, [allRows, visibleCount]);

  const hasMore = visibleCount < allRows.filter((r) => r.kind !== 'footer').length;

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setTimeout(() => {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      loadingMoreRef.current = false;
    }, 300);
  }, [hasMore]);

  const handleMoveToCart = useCallback(
    (item: WishlistItem) => {
      const alreadyInCart = cartItems.some((c) => c.product.id === item.product.id);
      if (!alreadyInCart) addToCart(item.product, 1);
      remove(item.product.id);
    },
    [addToCart, remove, cartItems]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      t.clearWishlist ?? 'Clear Wishlist',
      t.clearWishlistConfirm ?? 'Remove all items from your wishlist?',
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.clearAll ?? 'Clear All', style: 'destructive', onPress: () => clearAll() },
      ]
    );
  }, [clearAll, t]);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.myWishlist ?? 'My Wishlist'} />
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Heart size={40} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.signInToSave ?? 'Sign in to save favorites'}</Text>
          <Text style={styles.emptySubtitle}>
            {t.signInToSaveDesc ?? 'Create an account to save products and access your wishlist from any device.'}
          </Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/(tabs)/account' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.signInBtnText}>{t.signIn ?? 'Sign In'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLoading = loading || gearLoading;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.myWishlist ?? 'My Wishlist'} showBack />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.myWishlist ?? 'My Wishlist'} showBack />
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Heart size={40} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.wishlistEmpty ?? 'Your wishlist is empty'}</Text>
          <Text style={styles.emptySubtitle}>
            {t.wishlistEmptyDesc ?? 'Tap the heart icon on any product to save it here.'}
          </Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/(tabs)/products' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.signInBtnText}>{t.browseProducts ?? 'Browse Products'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderRow = ({ item: row }: { item: ListRow }) => {
    if (row.kind === 'divider') {
      return (
        <View style={styles.sectionDivider}>
          <View style={styles.sectionDividerLine} />
          <Text style={styles.sectionDividerText}>USED GEAR</Text>
          <View style={styles.sectionDividerLine} />
        </View>
      );
    }
    if (row.kind === 'footer') {
      if (hasMore) {
        return (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={Colors.neonBlue} />
          </View>
        );
      }
      return (
        <View style={styles.footerEnd}>
          <View style={styles.footerEndLine} />
          <Text style={styles.footerEndText}>No more items</Text>
          <View style={styles.footerEndLine} />
        </View>
      );
    }
    if (row.kind === 'product') {
      return (
        <WishlistCard
          item={row.item}
          language={language}
          onAddToCart={() => handleMoveToCart(row.item)}
          onRemove={() => remove(row.item.product.id)}
          onView={() => router.push(`/product/${row.item.product.id}` as any)}
          screenWidth={width}
        />
      );
    }
    return (
      <GearWishlistCard
        item={row.item}
        onRemove={() => removeGear(row.item.listing.id)}
        onView={() => router.push({ pathname: '/marketplace/[id]', params: { id: row.item.listing.id } } as any)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t.myWishlist ?? 'My Wishlist'} showBack />

      <View style={styles.listHeader}>
        <Text style={styles.listCount}>
          {totalCount} {totalCount === 1 ? (t.item ?? 'item') : (t.items ?? 'items')}
        </Text>
        {count > 0 && (
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7} style={styles.clearBtn}>
            <Trash2 size={14} color={Colors.error} strokeWidth={2} />
            <Text style={styles.clearBtnText}>{t.clearAll ?? 'Clear All'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={visibleRows}
        keyExtractor={(row, i) => {
          if (row.kind === 'product') return `p-${row.item.id}`;
          if (row.kind === 'gear') return `g-${row.item.id}`;
          if (row.kind === 'divider') return 'divider';
          return `footer-${i}`;
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={renderRow}
      />
    </View>
  );
}

function WishlistCard({
  item,
  language,
  onAddToCart,
  onRemove,
  onView,
  screenWidth,
}: {
  item: WishlistItem;
  language: string;
  onAddToCart: () => void;
  onRemove: () => void;
  onView: () => void;
  screenWidth: number;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const { t } = useLanguage();

  const animateOut = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -60, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => cb());
    },
    [slideAnim, opacityAnim]
  );

  const handleRemove = useCallback(() => animateOut(onRemove), [onRemove, animateOut]);
  const handleCartMove = useCallback(() => animateOut(onAddToCart), [onAddToCart, animateOut]);

  const product = item.product;
  const imageUri = getProductImage(product);
  const name = getProductName(product, language);

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ translateX: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <TouchableOpacity onPress={onView} activeOpacity={0.9} style={styles.cardImageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
        )}
        {product.badge && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{product.badge}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cardInfo} onPress={onView} activeOpacity={0.9}>
        <Text style={styles.cardCategory}>{product.category?.toUpperCase()}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{name}</Text>
        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPrice}>${product.price.toLocaleString()}</Text>
          {product.compare_price != null && product.compare_price > product.price && (
            <Text style={styles.cardCompare}>${product.compare_price.toLocaleString()}</Text>
          )}
        </View>
        {product.stock === 0 && (
          <Text style={styles.outOfStock}>{t.outOfStock ?? 'Out of Stock'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.cartBtn,
            product.stock === 0 && styles.actionBtnDisabled,
          ]}
          onPress={handleCartMove}
          disabled={product.stock === 0}
          activeOpacity={0.8}
        >
          <ShoppingCart size={14} color={product.stock === 0 ? Colors.textMuted : Colors.background} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={handleRemove}
          activeOpacity={0.8}
        >
          <X size={14} color={Colors.error} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function GearWishlistCard({
  item,
  onRemove,
  onView,
}: {
  item: GearWishlistItem;
  onRemove: () => void;
  onView: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animateOut = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -60, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => cb());
    },
    [slideAnim, opacityAnim]
  );

  const handleRemove = useCallback(() => animateOut(onRemove), [onRemove, animateOut]);

  const listing = item.listing;
  const thumb = listing.images?.[0];
  const contactRaw = listing.contact?.replace(/\s/g, '') ?? '';
  const phoneDigits = contactRaw.replace(/[^0-9]/g, '');
  const waMessage = encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title}`);

  const handleWhatsApp = () => {
    if (phoneDigits) {
      Linking.openURL(`https://wa.me/${phoneDigits}?text=${waMessage}`).catch(() => {});
    }
  };

  return (
    <Animated.View
      style={[styles.card, { transform: [{ translateX: slideAnim }], opacity: opacityAnim }]}
    >
      <TouchableOpacity onPress={onView} activeOpacity={0.9} style={styles.cardImageWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Tag size={24} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
        )}
        <View style={styles.gearTypeBadge}>
          <Text style={styles.gearTypeBadgeText}>USED GEAR</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cardInfo} onPress={onView} activeOpacity={0.9}>
        <Text style={styles.cardCategory}>{listing.category?.toUpperCase()}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{listing.title}</Text>
        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPrice}>${Number(listing.price).toLocaleString()}</Text>
        </View>
        {listing.status === 'sold' && (
          <Text style={styles.outOfStock}>SOLD</Text>
        )}
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.contactBtn]}
          onPress={handleWhatsApp}
          activeOpacity={0.8}
        >
          <MessageCircle size={14} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={handleRemove}
          activeOpacity={0.8}
        >
          <X size={14} color={Colors.error} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  signInBtn: {
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 11,
    borderRadius: Radius.full,
  },
  signInBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listCount: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  sectionDividerText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.card,
  },
  cardImageWrap: {
    position: 'relative',
    width: 76,
    height: 84,
    flexShrink: 0,
  },
  cardImage: {
    width: 76,
    height: 84,
    backgroundColor: Colors.backgroundSecondary,
  },
  cardImagePlaceholder: {
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cardBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  gearTypeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255,179,0,0.85)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  gearTypeBadgeText: {
    color: Colors.background,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardInfo: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  cardCategory: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  cardPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  cardCompare: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  outOfStock: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'column',
    gap: Spacing.xs,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cartBtn: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  contactBtn: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  removeBtn: {
    backgroundColor: Colors.error + '15',
    borderColor: Colors.error + '40',
  },
  actionBtnDisabled: {
    backgroundColor: Colors.backgroundSecondary,
    borderColor: Colors.border,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 10,
  },
  footerEndLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  footerEndText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
