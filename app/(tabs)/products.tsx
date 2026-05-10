import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShoppingBag, ShoppingCart, Heart } from 'lucide-react-native';
import { fetchProducts, fetchCategories, getProductName, getProductImage, getCategoryName, Product, Category } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useWishlistToast } from '@/context/WishlistToastContext';
import AppHeader from '@/components/AppHeader';
import SearchBar from '@/components/SearchBar';
import SearchOverlay from '@/components/SearchOverlay';
import StarRating from '@/components/StarRating';
import { Spacing, FontSize, Radius } from '@/constants/theme';
import { useTheme, useThemeColors, ThemeColors } from '@/context/ThemeContext';
import { type SuggestionSource } from '@/hooks/useSearchSuggestions';

const PAGE_SIZE = 10;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function matchesSearch(product: Product, query: string, language: string): boolean {
  const q = query.toLowerCase();
  const name = (getProductName(product, language) ?? '').toLowerCase();
  const nameEn = (product.name ?? '').toLowerCase();
  const nameAr = (product.name_ar ?? '').toLowerCase();
  const cat = (product.category ?? '').toLowerCase();
  const sku = (product.sku ?? '').toLowerCase();
  const desc = (product.description ?? '').toLowerCase();
  // Price: match both plain number string and formatted "$1,234"
  const price = product.price != null ? String(product.price) : '';
  const priceFmt = product.price != null ? product.price.toLocaleString() : '';
  return (
    name.includes(q) ||
    nameEn.includes(q) ||
    nameAr.includes(q) ||
    cat.includes(q) ||
    sku.includes(q) ||
    desc.includes(q) ||
    price.includes(q) ||
    priceFmt.includes(q)
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const { language, t, isRTL } = useLanguage();
  const { width } = useWindowDimensions();
  const C = useThemeColors();
  const styles = makeStyles(C);

  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam ?? null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [overlayOpen, setOverlayOpen] = useState(false);

  const fetchingRef = useRef(false);
  const pageRef = useRef(0);

  // Build suggestion source from loaded products + categories
  const suggestionSource = useMemo<SuggestionSource>(() => ({
    productNames: (allProducts.length > 0 ? allProducts : products).map((p) => ({
      en: p.name,
      ar: p.name_ar,
      category: p.category,
    })),
    categoryNames: categories.map((c) => getCategoryName(c, language)),
    gearTerms: [],
  }), [allProducts, products, categories, language]);

  useEffect(() => {
    setSelectedCategory(categoryParam ?? null);
  }, [categoryParam]);

  const commitSearch = useCallback((term: string) => {
    setSearchQuery(term.trim());
    setOverlayOpen(false);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const resetAndLoad = useCallback(async (lang: string, cat: string | null) => {
    setLoading(true);
    setProducts([]);
    setAllProducts([]);
    setHasMore(true);
    pageRef.current = 0;
    fetchingRef.current = false;
    try {
      const [prods, cats] = await Promise.all([
        fetchProducts({ language: lang, category: cat ?? undefined, limit: PAGE_SIZE, offset: 0 }),
        fetchCategories(lang),
      ]);
      setProducts(prods);
      setCategories(cats);
      setHasMore(prods.length === PAGE_SIZE);
      pageRef.current = 1;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore || searchQuery) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const offset = pageRef.current * PAGE_SIZE;
      const prods = await fetchProducts({
        language,
        category: selectedCategory ?? undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setProducts((prev) => [...prev, ...prods]);
      setHasMore(prods.length === PAGE_SIZE);
      pageRef.current += 1;
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, language, selectedCategory, searchQuery]);

  const loadAllForSearch = useCallback(async (lang: string, cat: string | null) => {
    if (allProducts.length > 0) return;
    const all = await fetchProducts({ language: lang, category: cat ?? undefined });
    setAllProducts(all);
  }, [allProducts.length]);

  useEffect(() => {
    resetAndLoad(language, selectedCategory);
  }, [language, selectedCategory, resetAndLoad]);

  useEffect(() => {
    if (searchQuery) {
      loadAllForSearch(language, selectedCategory);
    }
  }, [searchQuery, language, selectedCategory, loadAllForSearch]);

  const numCols = width >= 768 ? 3 : 2;
  const SIDE_PAD = 10;
  const GAP = 7;
  const cardW = (width - SIDE_PAD * 2 - GAP * (numCols - 1)) / numCols;

  const activeLabel = useMemo(() => {
    if (!selectedCategory) return 'All Products';
    const cat = categories.find(c => c.slug === selectedCategory);
    return cat ? getCategoryName(cat, language) : capitalize(selectedCategory);
  }, [selectedCategory, categories, language]);

  const displayedProducts = useMemo(() => {
    if (!searchQuery) return products;
    const pool = allProducts.length > 0 ? allProducts : products;
    return pool.filter((p) => matchesSearch(p, searchQuery, language));
  }, [searchQuery, products, allProducts, language]);

  const isSearching = searchQuery.length > 0;
  const showSearchLoading = isSearching && allProducts.length === 0 && !loading;

  const renderFooter = () => {
    if (!isSearching && loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={C.neonBlue} />
        </View>
      );
    }
    if (!isSearching && !hasMore && products.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <View style={styles.footerEndLine} />
          <Text style={styles.footerEndText}>No more products</Text>
          <View style={styles.footerEndLine} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <AppHeader title={activeLabel} showBack />

      {/* ── Search bar (tap to open overlay) ── */}
      <View style={styles.searchWrap}>
        <SearchBar
          activeQuery={searchQuery}
          placeholder={t.searchProducts ?? 'Search products…'}
          onOpen={() => setOverlayOpen(true)}
          onClear={clearSearch}
        />
      </View>

      {/* ── Search overlay ── */}
      <SearchOverlay
        visible={overlayOpen}
        source={suggestionSource}
        initialQuery={searchQuery}
        placeholder={t.searchProducts ?? 'Search products…'}
        onClose={() => setOverlayOpen(false)}
        onCommit={commitSearch}
      />

      {/* ── Search meta row: results count ── */}
      {isSearching && !loading && (
        <View style={styles.searchMeta}>
          {showSearchLoading ? (
            <ActivityIndicator size="small" color={C.neonBlue} style={{ marginRight: 6 }} />
          ) : (
            <Text style={styles.searchMetaText}>
              {displayedProducts.length === 0
                ? (t.noResultsFor ?? `No results for`) + ` "${searchQuery}"`
                : `${displayedProducts.length} ${displayedProducts.length === 1 ? 'result' : 'results'} for "${searchQuery}"`}
            </Text>
          )}
          <TouchableOpacity onPress={clearSearch} activeOpacity={0.7} style={styles.searchMetaClear}>
            <Text style={styles.searchMetaClearText}>{t.clearSearch ?? 'Clear'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Category chips ── */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...categories.map(c => c.slug)]}
          keyExtractor={item => item ?? '__all__'}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = item === selectedCategory;
            const label = item === null
              ? (t.filterAll ?? 'All')
              : (categories.find(c => c.slug === item)
                  ? getCategoryName(categories.find(c => c.slug === item)!, language)
                  : capitalize(item));
            return (
              <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedCategory(item)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.neonBlue} />
          <Text style={styles.loadingText}>{t.loading ?? 'Loading…'}</Text>
        </View>
      ) : displayedProducts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <ShoppingBag size={36} color={C.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>
            {isSearching ? (t.noResultsFor ?? 'No results for') + ` "${searchQuery}"` : (t.noProductsFound ?? 'No products found')}
          </Text>
          <Text style={styles.emptySubtext}>
            {isSearching
              ? (t.tryDifferentSearch ?? 'Try a different keyword or clear filters')
              : (t.checkBackSoon ?? 'Check back soon for new arrivals')}
          </Text>
          {isSearching && (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.75} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchBtnText}>{t.clearSearch ?? 'Clear search'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayedProducts}
          keyExtractor={item => item.id}
          numColumns={numCols}
          key={`cols-${numCols}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.grid, { padding: SIDE_PAD, gap: GAP }]}
          columnWrapperStyle={numCols > 1 ? { gap: GAP } : undefined}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              cardW={cardW}
              language={language}
              onPress={() => router.push(`/product/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function ProductCard({
  product, cardW, language, onPress,
}: {
  product: Product; cardW: number; language: string; onPress: () => void;
}) {
  const { addToCart } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { showCartToast, showWishlistToast } = useWishlistToast();
  const C = useThemeColors();
  const { preset } = useTheme();
  const isLight = preset === 'light';
  const styles = makeStyles(C);
  const imgH = Math.round(cardW * 0.65);
  const saved = isWishlisted(product.id);

  const handleAddToCart = useCallback((e: any) => {
    e.stopPropagation();
    const result = addToCart(product, 1);
    showCartToast(result.ok ? 'Added to cart' : `Only ${(result as any).available} in stock`);
  }, [product, addToCart, showCartToast]);

  const handleWishlist = useCallback(async (e: any) => {
    e.stopPropagation();
    const { added } = await toggle(product);
    showWishlistToast(added, added ? 'Added to wishlist' : 'Removed from wishlist');
  }, [product, toggle, showWishlistToast]);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardW }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.cardImageWrap, { height: imgH }]}>
        <Image
          source={{ uri: getProductImage(product) }}
          style={[StyleSheet.absoluteFillObject, styles.cardImage]}
          resizeMode="cover"
        />
        {product.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={handleWishlist}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Heart
            size={13}
            color={saved ? '#FF4D6D' : (isLight ? C.neonBlue : 'rgba(255,255,255,0.85)')}
            fill={saved ? '#FF4D6D' : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {getProductName(product, language)}
        </Text>
        <StarRating rating={product.rating} reviewCount={product.review_count} size={8} showCount={false} />
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>${product.price.toLocaleString()}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cartBtn}
              activeOpacity={0.85}
              onPress={handleAddToCart}
            >
              <ShoppingCart size={11} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewBtn}
              activeOpacity={0.85}
              onPress={(e) => { e.stopPropagation(); onPress(); }}
            >
              <Text style={styles.viewBtnText}>VIEW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    searchWrap: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: C.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },

    // Search meta: result count + clear button
    searchMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: C.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 8,
    },
    searchMetaText: {
      flex: 1,
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '600',
    },
    searchMetaClear: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
    },
    searchMetaClearText: {
      color: C.neonBlue,
      fontSize: FontSize.xs,
      fontWeight: '700',
    },

    filterWrap: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.backgroundSecondary,
    },
    filterContent: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: 'transparent',
    },
    chipActive: {
      backgroundColor: C.neonBlue,
      borderColor: C.neonBlue,
    },
    chipText: {
      color: C.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    chipTextActive: {
      color: C.white,
      fontWeight: '700',
    },

    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: C.textMuted, fontSize: FontSize.sm },

    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 32,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.backgroundCard,
      borderWidth: 1,
      borderColor: C.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      color: C.textPrimary,
      fontSize: FontSize.md,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptySubtext: {
      color: C.textMuted,
      fontSize: FontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    clearSearchBtn: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
      borderRadius: Radius.full,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    clearSearchBtnText: {
      color: C.neonBlue,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },

    grid: { paddingBottom: 16 },

    card: {
      backgroundColor: C.backgroundCard,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
      overflow: 'hidden',
      marginBottom: 7,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
    },
    cardImageWrap: {
      width: '100%',
      backgroundColor: C.backgroundSecondary,
      position: 'relative',
      overflow: 'hidden',
    },
    cardImage: { objectFit: 'cover' } as any,
    badge: {
      position: 'absolute',
      top: 5,
      left: 5,
      backgroundColor: C.neonBlue,
      borderRadius: 3,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    badgeText: {
      color: C.white,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    cardBody: { padding: 7, gap: 2 },
    cardName: {
      color: C.textPrimary,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 3,
    },
    cardPrice: {
      color: C.neonBlue,
      fontSize: 12,
      fontWeight: '900',
    },
    heartBtn: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.overlay,
      borderWidth: 1,
      borderColor: C.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cartBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.neonBlue,
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewBtn: {
      backgroundColor: C.neonBlue,
      borderRadius: Radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    viewBtnText: {
      color: C.white,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },

    footerLoader: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    footerEnd: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 24,
      gap: 10,
    },
    footerEndLine: {
      flex: 1,
      height: 1,
      backgroundColor: C.border,
    },
    footerEndText: {
      color: C.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
  });
}
