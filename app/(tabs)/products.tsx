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
  TextInput,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShoppingBag, Search, X, ShoppingCart, Heart } from 'lucide-react-native';
import { fetchProducts, fetchCategories, getProductName, getProductImage, getCategoryName, Product, Category } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useWishlistToast } from '@/context/WishlistToastContext';
import AppHeader from '@/components/AppHeader';
import StarRating from '@/components/StarRating';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

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
  return (
    name.includes(q) ||
    nameEn.includes(q) ||
    nameAr.includes(q) ||
    cat.includes(q) ||
    sku.includes(q) ||
    desc.includes(q)
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();

  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam ?? null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchingRef = useRef(false);
  const pageRef = useRef(0);

  useEffect(() => {
    setSelectedCategory(categoryParam ?? null);
  }, [categoryParam]);

  // Debounce search input
  const handleSearchChange = useCallback((text: string) => {
    setRawSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(text.trim()), 300);
  }, []);

  const clearSearch = useCallback(() => {
    setRawSearch('');
    setSearchQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
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

  // When search is active, load ALL products for this filter into allProducts
  const loadAllForSearch = useCallback(async (lang: string, cat: string | null) => {
    if (allProducts.length > 0) return; // already loaded
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

  const renderFooter = () => {
    if (!isSearching && loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.neonBlue} />
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

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={15} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products…"
            placeholderTextColor={Colors.textMuted}
            value={rawSearch}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {rawSearch.length > 0 && (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={Colors.textMuted} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter chips */}
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
              ? 'All'
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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.neonBlue} />
        </View>
      ) : displayedProducts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ShoppingBag size={48} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>
            {isSearching ? `No results for "${searchQuery}"` : 'No products found'}
          </Text>
          {isSearching && (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.75} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchBtnText}>Clear search</Text>
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
            color={saved ? '#FF4D6D' : '#6B7E96'}
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
              <ShoppingCart size={11} color={Colors.white} strokeWidth={2} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  searchWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 9,
    paddingVertical: Platform.OS === 'ios' ? 7 : 5,
    gap: 7,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
    margin: 0,
  },

  filterWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
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
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.background,
    fontWeight: '700',
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md, textAlign: 'center', paddingHorizontal: 24 },
  clearSearchBtn: {
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  clearSearchBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  grid: { paddingBottom: 16 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
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
    backgroundColor: '#F0F4F8',
    position: 'relative',
    overflow: 'hidden',
  },
  cardImage: { objectFit: 'cover' } as any,
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: Colors.neonBlue,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    color: Colors.background,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardBody: { padding: 7, gap: 2 },
  cardName: {
    color: '#1A2332',
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
    color: Colors.neonBlue,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
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
    backgroundColor: 'rgba(0,191,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  viewBtnText: {
    color: Colors.background,
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
    backgroundColor: Colors.border,
  },
  footerEndText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
