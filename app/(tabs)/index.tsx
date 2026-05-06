import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  TextInput,
  I18nManager,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Star, Search, X, ShoppingCart, Heart } from 'lucide-react-native';
import { supabase, Product } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import AppHeader from '@/components/AppHeader';
import { useLanguage } from '@/context/LanguageContext';
import { PageBlock } from '@/context/PageBuilderContext';
import { useLayout, SectionId, SpacingBreakpoint } from '@/context/LayoutContext';
import { Radius } from '@/constants/theme';
import { useTheme, useThemeColors } from '@/context/ThemeContext';
import HeroVideo from '@/components/HeroVideo';
import { fetchProducts, fetchCategories, getProductName, getProductImage, getCategoryName, Category } from '@/lib/supabase';
import StarRating from '@/components/StarRating';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useWishlistToast } from '@/context/WishlistToastContext';
import { AutoScrollRow } from '@/components/AutoScrollRow';

type HomeSection = {
  id: string;
  name_en: string;
  name_ar: string;
  enabled: boolean;
  sort_order: number;
};

type HomeSectionWithProducts = HomeSection & {
  products: Product[];
};

const LOGO = require('../../assets/images/logo.png');

type Review = {
  id: string;
  product_id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  status: string;
  created_at: string;
};

function clampSpacing(sp: SpacingBreakpoint): SpacingBreakpoint {
  return {
    marginTop:     Math.max(0, Math.min(200, sp.marginTop)),
    marginBottom:  Math.max(0, Math.min(200, sp.marginBottom)),
    paddingTop:    Math.max(0, Math.min(160, sp.paddingTop)),
    paddingBottom: Math.max(0, Math.min(160, sp.paddingBottom)),
    paddingLeft:   Math.max(0, Math.min(120, sp.paddingLeft)),
    paddingRight:  Math.max(0, Math.min(120, sp.paddingRight)),
    maxWidth:      Math.max(0, Math.min(1800, sp.maxWidth)),
    borderRadius:  Math.max(0, Math.min(64, sp.borderRadius)),
  };
}

function useSectionSpacing(id: SectionId) {
  const { width } = useWindowDimensions();
  const { getSectionLayout } = useLayout();
  const section = getSectionLayout(id);
  const bp = width >= 1024 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile';
  return {
    spacing: clampSpacing(section[bp]),
    typography: section.typography,
    layout: section.layout,
    isRTL: I18nManager.isRTL,
  };
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const MAX_RECENT = 5;

function matchesQuery(product: Product, q: string, lang: string): boolean {
  const lower = q.toLowerCase();
  return (
    (getProductName(product, lang) ?? '').toLowerCase().includes(lower) ||
    (product.name ?? '').toLowerCase().includes(lower) ||
    (product.name_ar ?? '').toLowerCase().includes(lower) ||
    (product.category ?? '').toLowerCase().includes(lower) ||
    (product.description ?? '').toLowerCase().includes(lower) ||
    (product.sku ?? '').toLowerCase().includes(lower)
  );
}

export default function ShopScreen() {
  const { language, t, isRTL } = useLanguage();
  const { content, cmsRow, refresh: refreshCMS } = useCMS();
  const { colors } = useTheme();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homeSections, setHomeSections] = useState<HomeSectionWithProducts[]>([]);

  // ── Search state ────────────────────────────────────────────────────────────
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const commitSearch = useCallback((term: string) => {
    if (!term.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term.trim());
      return [term.trim(), ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return products.filter(p => matchesQuery(p, searchQuery, language));
  }, [searchQuery, products, language]);

  // Track the language this component last committed data for.
  // Any fetch that finishes after a language change is silently dropped.
  const committedLanguage = useRef(language);

  const fetchAll = useCallback(async (fetchLang: string) => {
    const [productsResult, categoriesResult, layoutRes, reviewsRes, sectionsRes] = await Promise.allSettled([
      fetchProducts({ language: fetchLang }),
      fetchCategories(fetchLang),
      supabase.from('page_layouts').select('id').eq('page', 'home').maybeSingle(),
      supabase.from('reviews').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(12),
      supabase.from('home_sections').select('*').eq('enabled', true).order('sort_order', { ascending: true }),
    ]);

    // Drop stale results if language changed while fetch was in-flight
    if (committedLanguage.current !== fetchLang) return;

    if (productsResult.status === 'fulfilled') setProducts(productsResult.value);
    if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
    if (reviewsRes.status === 'fulfilled' && !reviewsRes.value.error && reviewsRes.value.data) {
      setReviews(reviewsRes.value.data);
    }

    if (layoutRes.status === 'fulfilled' && layoutRes.value.data) {
      const { data: blocksData } = await supabase
        .from('page_blocks')
        .select('*')
        .eq('layout_id', layoutRes.value.data.id)
        .order('order_index', { ascending: true });
      if (committedLanguage.current !== fetchLang) return;
      if (blocksData) setBlocks(blocksData as PageBlock[]);
    }

    // Load products for each enabled section
    if (sectionsRes.status === 'fulfilled' && !sectionsRes.value.error && sectionsRes.value.data) {
      const rawSections = sectionsRes.value.data as HomeSection[];
      if (rawSections.length > 0) {
        const { data: spRows } = await supabase
          .from('home_section_products')
          .select('section_id, product_id, sort_order')
          .in('section_id', rawSections.map((s) => s.id))
          .order('sort_order', { ascending: true });

        if (committedLanguage.current !== fetchLang) return;

        const productIds = [...new Set((spRows ?? []).map((r: any) => r.product_id))];
        let productMap: Record<string, Product> = {};

        if (productIds.length > 0) {
          const { data: sectionProds } = await supabase
            .from('products')
            .select('*')
            .in('id', productIds);
          if (committedLanguage.current !== fetchLang) return;
          (sectionProds ?? []).forEach((p: any) => { productMap[p.id] = p; });
        }

        const enriched: HomeSectionWithProducts[] = rawSections.map((s) => ({
          ...s,
          products: (spRows ?? [])
            .filter((r: any) => r.section_id === s.id)
            .map((r: any) => productMap[r.product_id])
            .filter(Boolean) as Product[],
        }));
        setHomeSections(enriched.filter((s) => s.products.length > 0));
      } else {
        setHomeSections([]);
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // Update the ref synchronously before any async work so in-flight fetches
    // for the previous language know they are stale.
    committedLanguage.current = language;
    // Clear products immediately so old-language names don't flash
    setProducts([]);
    setLoading(true);
    fetchAll(language);
  }, [language, fetchAll]);

  const visibleBlocks = useMemo(() => blocks.filter(b => b.visible), [blocks]);

  const heroBlock = visibleBlocks.find(b => b.type === 'hero');
  const featuredBlock = visibleBlocks.find(b => b.type === 'featured');
  const canopyBlock = visibleBlocks.find(b => b.type === 'canopy');

  const cmsHero = content.hero ?? {};
  const cmsFeatured = content.featured ?? {};
  const cmsCanopy = content.canopy ?? {};
  const cmsTestimonials = content.testimonials ?? {};

  const HERO_FALLBACK_IMAGE = 'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800';

  const heroContent = heroBlock
    ? { ...heroBlock.content }
    : {
        media_type:    cmsHero.media_type    || 'image',
        image_url:     cmsHero.image_url     || HERO_FALLBACK_IMAGE,
        video_url:     cmsHero.video_url     || '',
        title:         cmsHero.title         || cmsRow?.hero_title      || t.heroDefault.title,
        subtitle:      cmsHero.subtitle      || cmsRow?.hero_subtitle   || t.heroDefault.subtitle,
        badge_text:    cmsHero.badge_text    || t.heroDefault.badge,
        cta_primary:   cmsHero.cta_primary   || cmsRow?.hero_button_text || t.shop,
        cta_secondary: cmsHero.cta_secondary || '',
        overlay_color: cmsHero.overlay_color || 'rgba(5,10,20,0.55)',
      };

  const featuredTitle = featuredBlock?.content?.title || cmsRow?.featured_title || cmsFeatured.title || t.sectionFeatured;
  const featuredProducts = useMemo(() => products.filter(p => p.featured).slice(0, 6), [products]);
  const displayProducts = featuredProducts.length > 0 ? featuredProducts : products.slice(0, 6);

  const canopyTitle = canopyBlock?.content?.title || cmsRow?.canopy_title || cmsCanopy.title || t.canopyAdvisor;
  const canopyCtaText = canopyBlock?.content?.cta_text || cmsCanopy.cta_text || t.getRecommendation;

  const testimonialsTitle = cmsRow?.testimonial_title || cmsTestimonials.title || t.sectionTestimonials;

  const showCanopySection = blocks.length === 0
    ? (content.canopy?.enabled ?? 'true') !== 'false'
    : !!canopyBlock;

  const showTestimonialsSection = blocks.length === 0
    ? (content.testimonials?.enabled ?? 'true') !== 'false'
    : !!visibleBlocks.find(b => b.type === 'testimonials');

  const isSearchActive = rawSearch.length > 0 || searchQuery.length > 0;
  const placeholder = language === 'ar'
    ? 'ابحث عن المنتجات أو الفئات...'
    : (t.searchPlaceholder ?? 'Search gear, categories...');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setHomeSections([]);
              committedLanguage.current = language;
              fetchAll(language);
              refreshCMS(language);
            }}
            tintColor={colors.neonBlue}
          />
        }
      >
        {/* ── Sticky Search Bar ─────────────────────────────────────────────── */}
        <HomeSearchBar
          value={rawSearch}
          placeholder={placeholder}
          isRTL={isRTL}
          onChange={handleSearchChange}
          onClear={clearSearch}
          onSubmit={() => commitSearch(rawSearch)}
          bgColor={colors.background}
          inputBg={colors.backgroundSecondary}
          accentColor={colors.neonBlue}
          textColor={colors.textPrimary}
        />

        {/* ── Search Results / Recent ────────────────────────────────────────── */}
        {isSearchActive ? (
          <SearchResultsPanel
            query={searchQuery}
            results={searchResults}
            recentSearches={recentSearches}
            language={language}
            isRTL={isRTL}
            onSelect={(term) => {
              commitSearch(term);
              handleSearchChange(term);
            }}
            onProductPress={(id) => router.push(`/product/${id}`)}
            onClearRecent={() => setRecentSearches([])}
            colors={colors}
          />
        ) : (
          <>
            <HeroVideo heroContent={heroContent} />
            {categories.length > 0 && (
              <ShopByCategorySection categories={categories} language={language} t={t} />
            )}
            <FeaturedSection title={featuredTitle} products={displayProducts} language={language} t={t} />
            {homeSections.map((section) => (
              <FeaturedSection
                key={section.id}
                title={language === 'ar' && section.name_ar ? section.name_ar : section.name_en}
                products={section.products}
                language={language}
                t={t}
              />
            ))}
            {showCanopySection && (
              <CanopyFinderSection title={canopyTitle} ctaText={canopyCtaText} t={t} />
            )}
            {showTestimonialsSection && (
              <GallerySection title={testimonialsTitle} reviews={reviews} />
            )}
            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Home Search Bar ─────────────────────────────────────────────────────────

function HomeSearchBar({
  value, placeholder, isRTL, onChange, onClear, onSubmit,
  bgColor, inputBg, accentColor, textColor,
}: {
  value: string;
  placeholder: string;
  isRTL: boolean;
  onChange: (text: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  bgColor: string;
  inputBg: string;
  accentColor: string;
  textColor: string;
}) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () =>
    Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const onBlur = () =>
    Animated.timing(glowAnim, { toValue: 0, duration: 250, useNativeDriver: false }).start();

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [accentColor + '47', accentColor + 'D9'],
  });
  const shadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.55] });

  return (
    <View style={[searchBarStyles.wrapper, { backgroundColor: bgColor, borderBottomColor: accentColor + '1A' }]}>
      <Animated.View style={[
        searchBarStyles.bar,
        { borderColor, shadowOpacity, backgroundColor: inputBg, shadowColor: accentColor },
        isRTL && searchBarStyles.barRTL,
      ]}>
        <Search size={16} color={accentColor + 'B3'} strokeWidth={2} />
        <TextInput
          style={[searchBarStyles.input, { color: textColor }, isRTL && searchBarStyles.inputRTL]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={accentColor + '73'}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          textAlign={isRTL ? 'right' : 'left'}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <X size={14} color={accentColor + '99'} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const searchBarStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#050A14',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,191,255,0.1)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10,22,40,0.92)',
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  barRTL: { flexDirection: 'row-reverse' },
  input: {
    flex: 1,
    color: '#E8F4FD',
    fontSize: 13,
    padding: 0,
    margin: 0,
  },
  inputRTL: { textAlign: 'right' },
});

// ─── Search Results Panel ─────────────────────────────────────────────────────

function SearchResultsPanel({
  query, results, recentSearches, language, isRTL,
  onSelect, onProductPress, onClearRecent, colors,
}: {
  query: string;
  results: Product[];
  recentSearches: string[];
  language: string;
  isRTL: boolean;
  onSelect: (term: string) => void;
  onProductPress: (id: string) => void;
  onClearRecent: () => void;
  colors: { background: string; backgroundCard: string; neonBlue: string; textPrimary: string; textMuted: string; border: string };
}) {
  const { width } = useWindowDimensions();

  if (!query && recentSearches.length === 0) return null;

  if (!query && recentSearches.length > 0) {
    return (
      <View style={[resultsStyles.container, { backgroundColor: colors.background }]}>
        <View style={[resultsStyles.recentHeader, isRTL && resultsStyles.rowRTL]}>
          <Text style={[resultsStyles.recentLabel, { color: colors.textMuted }]}>Recent</Text>
          <TouchableOpacity onPress={onClearRecent} activeOpacity={0.7}>
            <Text style={[resultsStyles.clearBtn, { color: colors.neonBlue }]}>Clear</Text>
          </TouchableOpacity>
        </View>
        {recentSearches.map(term => (
          <TouchableOpacity
            key={term}
            style={[resultsStyles.recentItem, isRTL && resultsStyles.rowRTL, { borderTopColor: colors.border }]}
            onPress={() => onSelect(term)}
            activeOpacity={0.7}
          >
            <Search size={12} color={colors.neonBlue + '80'} strokeWidth={2} />
            <Text style={[resultsStyles.recentText, { color: colors.textPrimary }]}>{term}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={[resultsStyles.emptyWrap, { backgroundColor: colors.background }]}>
        <Search size={32} color={colors.neonBlue + '40'} strokeWidth={1.5} />
        <Text style={[resultsStyles.emptyText, { color: colors.textPrimary }]}>No results for "{query}"</Text>
        <Text style={[resultsStyles.emptySubtext, { color: colors.textMuted }]}>Try a different search term</Text>
      </View>
    );
  }

  const SIDE = 12;
  const GAP = 8;
  const cols = width >= 600 ? 3 : 2;
  const cardW = (width - SIDE * 2 - GAP * (cols - 1)) / cols;
  const imgH = Math.round(cardW * 0.6);

  return (
    <View style={[resultsStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[resultsStyles.countText, { color: colors.textMuted }]}>{results.length} result{results.length !== 1 ? 's' : ''}</Text>
      <FlatList
        data={results}
        keyExtractor={p => p.id}
        numColumns={cols}
        key={`sr-${cols}`}
        scrollEnabled={false}
        contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP, paddingBottom: 16 }}
        columnWrapperStyle={cols > 1 ? { gap: GAP } : undefined}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[resultsStyles.card, { width: cardW, marginBottom: GAP, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => onProductPress(item.id)}
            activeOpacity={0.85}
          >
            <View style={[resultsStyles.cardImg, { height: imgH }]}>
              <Image
                source={{ uri: getProductImage(item) }}
                style={[StyleSheet.absoluteFillObject, { objectFit: 'cover' } as any]}
                resizeMode="cover"
              />
              {item.badge && (
                <View style={[resultsStyles.badge, { backgroundColor: colors.neonBlue }]}>
                  <Text style={[resultsStyles.badgeText, { color: colors.background }]}>{item.badge}</Text>
                </View>
              )}
            </View>
            <View style={resultsStyles.cardBody}>
              <Text style={[resultsStyles.cardName, { color: colors.textPrimary }, isRTL && { textAlign: 'right' }]} numberOfLines={2}>
                {getProductName(item, language)}
              </Text>
              <Text style={[resultsStyles.cardPrice, { color: colors.neonBlue }]}>${item.price.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const resultsStyles = StyleSheet.create({
  container: {
    backgroundColor: '#050A14',
    minHeight: 200,
    paddingTop: 8,
  },
  rowRTL: { flexDirection: 'row-reverse' },
  countText: {
    color: 'rgba(150,190,220,0.5)',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#0D1E35',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.15)',
    overflow: 'hidden',
  },
  cardImg: {
    width: '100%',
    backgroundColor: '#0A1628',
    position: 'relative',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 8, fontWeight: '800' },
  cardBody: { padding: 7, gap: 2 },
  cardName: {
    color: '#E8F4FD',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: '900',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  recentLabel: { color: 'rgba(150,190,220,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  clearBtn: { fontSize: 11, fontWeight: '700' },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,191,255,0.07)',
  },
  recentText: { color: '#C8DFF0', fontSize: 13, fontWeight: '500' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: { color: '#C8DFF0', fontSize: 14, fontWeight: '600' },
  emptySubtext: { color: 'rgba(150,190,220,0.45)', fontSize: 12 },
});

// ─── Shop By Category Section ─────────────────────────────────────────────────

function ShopByCategorySection({
  categories,
  language,
  t,
}: {
  categories: Category[];
  language: string;
  t: { shopByCategory?: string };
}) {
  const router = useRouter();
  const colors = useThemeColors();

  const navigateToCategory = (slug: string) => {
    router.push(`/(tabs)/products?category=${slug}` as any);
  };

  const catItems = categories.map((cat) => {
    const name = getCategoryName(cat, language);
    return (
      <TouchableOpacity
        key={cat.id}
        style={catStyles.item}
        onPress={() => navigateToCategory(cat.slug)}
        activeOpacity={0.75}
      >
        <View style={catStyles.circle}>
          {cat.image ? (
            <Image
              source={{ uri: cat.image }}
              style={[StyleSheet.absoluteFillObject, catStyles.circleImage]}
              resizeMode="cover"
            />
          ) : (
            <View style={catStyles.circlePlaceholder}>
              <Text style={[catStyles.circlePlaceholderText, { color: colors.neonBlue }]}>
                {name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={catStyles.circleRing} />
        </View>
        <Text style={catStyles.label} numberOfLines={2}>
          {name}
        </Text>
      </TouchableOpacity>
    );
  });

  return (
    <View style={catStyles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {(t.shopByCategory ?? 'SHOP BY CATEGORY').toUpperCase()}
        </Text>
      </View>
      <AutoScrollRow
        itemWidth={60}
        gap={6}
        visibleCount={6}
        paddingHorizontal={10}
        speed={30}
      >
        {catItems}
      </AutoScrollRow>
    </View>
  );
}

const catStyles = StyleSheet.create({
  section: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingBottom: 4,
    gap: 6,
  },
  item: {
    width: 60,
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(0,191,255,0.35)',
    backgroundColor: '#0A1628',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  circleImage: {
    objectFit: 'cover',
  } as any,
  circlePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1E35',
  },
  circlePlaceholderText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  circleRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.18)',
  },
  label: {
    color: '#C8DFF0',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
    width: 60,
  },
});

// ─── Featured Products Section ────────────────────────────────────────────────

function FeaturedSection({ title, products, language, t }: { title: string; products: Product[]; language: string; t: { view: string; seeAll: string } }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { addToCart } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { showCartToast, showWishlistToast } = useWishlistToast();

  const productItems = products.map(product => (
    <FeaturedCard
      key={product.id}
      product={product}
      language={language}
      viewLabel={t.view}
      saved={isWishlisted(product.id)}
      onPress={() => router.push(`/product/${product.id}`)}
      onAddToCart={(e) => {
        e.stopPropagation();
        const result = addToCart(product, 1);
        showCartToast(result.ok ? 'Added to cart' : `Only ${(result as any).available} in stock`);
      }}
      onWishlist={async (e) => {
        e.stopPropagation();
        const { added } = await toggle(product);
        showWishlistToast(added, added ? 'Added to wishlist' : 'Removed from wishlist');
      }}
    />
  ));

  return (
    <View style={styles.featuredSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/products' as any)} activeOpacity={0.7}>
          <View style={styles.seeAllDots}>
            {[0, 1, 2].map(i => <View key={i} style={[styles.seeAllDot, { backgroundColor: colors.neonBlue }]} />)}
          </View>
          <ChevronRight size={13} color={colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <AutoScrollRow
        itemWidth={124}
        gap={8}
        visibleCount={6}
        paddingHorizontal={10}
        speed={22}
      >
        {productItems}
      </AutoScrollRow>
    </View>
  );
}

function FeaturedCard({
  product, language, viewLabel, saved, onPress, onAddToCart, onWishlist,
}: {
  product: Product;
  language: string;
  viewLabel: string;
  saved: boolean;
  onPress: () => void;
  onAddToCart: (e: any) => void;
  onWishlist: (e: any) => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={styles.featuredCard}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.featuredCardImageWrap}>
        <Image
          source={{ uri: getProductImage(product) }}
          style={[StyleSheet.absoluteFillObject, styles.featuredCardImage]}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.featuredHeartBtn}
          onPress={onWishlist}
          activeOpacity={0.75}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Heart
            size={11}
            color={saved ? '#FF4D6D' : 'rgba(255,255,255,0.85)'}
            fill={saved ? '#FF4D6D' : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.featuredCardInfo}>
        <Text style={styles.featuredCardName} numberOfLines={2}>
          {getProductName(product, language)}
        </Text>
        <StarRating
          rating={product.rating}
          reviewCount={product.review_count}
          size={9}
          showCount
        />
        <Text style={[styles.featuredCardPrice, { color: colors.neonBlue }]}>${product.price.toLocaleString()}</Text>
        <View style={styles.featuredCardActions}>
          <TouchableOpacity
            style={styles.featuredCartBtn}
            activeOpacity={0.85}
            onPress={onAddToCart}
          >
            <ShoppingCart size={10} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, { backgroundColor: colors.neonBlue, shadowColor: colors.neonBlue }]}
            activeOpacity={0.85}
            onPress={(e) => { e.stopPropagation(); onPress(); }}
          >
            <Text style={styles.viewBtnText}>{viewLabel.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Canopy Finder Section ────────────────────────────────────────────────────

function CanopyFinderSection({ title, ctaText, t }: { title: string; ctaText: string; t: { canopyWeightQuestion: string; canopyJumpsQuestion: string } }) {
  const router = useRouter();
  const colors = useThemeColors();
  const [weight, setWeight] = useState('175');
  const [jumps, setJumps] = useState('150');

  return (
    <View style={styles.canopySection}>
      {/* Subtle blue radial glow from top-left where the icon sits */}
      <LinearGradient
        colors={['rgba(0,100,200,0.18)', 'rgba(5,10,20,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.canopyInner}>

        {/* Title row: parachute icon + title */}
        <View style={styles.canopyTitleRow}>
          <Image source={LOGO} style={styles.canopyIcon} resizeMode="contain" />
          <Text style={[styles.canopyTitle, { color: colors.neonBlue, textShadowColor: colors.neonBlue + '99', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]}>{title.toUpperCase()}</Text>
        </View>

        {/* Weight field */}
        <View style={styles.canopyFieldRow}>
          <Text style={styles.canopyFieldLabel}>{t.canopyWeightQuestion}</Text>
          <View style={styles.canopyValueWrap}>
            <TextInput
              style={styles.canopyValueText}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />
            <Text style={styles.canopyValueUnit}> lbs</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.canopyDivider} />

        {/* Jumps field */}
        <View style={styles.canopyFieldRow}>
          <Text style={styles.canopyFieldLabel}>{t.canopyJumpsQuestion}</Text>
          <TextInput
            style={styles.canopyValueText}
            value={jumps}
            onChangeText={setJumps}
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.canopyBtn, { backgroundColor: colors.neonBlue, shadowColor: colors.neonBlue }]}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/canopy')}
        >
          <Text style={styles.canopyBtnText}>{ctaText.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Gallery / Social Proof Section ──────────────────────────────────────────

const GALLERY_IMAGES = [
  'https://images.pexels.com/photos/4057466/pexels-photo-4057466.jpeg?auto=compress&cs=tinysrgb&w=500',
  'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=500',
  'https://images.pexels.com/photos/2275159/pexels-photo-2275159.jpeg?auto=compress&cs=tinysrgb&w=500',
];

function GallerySection({ title, reviews }: { title: string; reviews: Review[] }) {
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const gap = 6;
  const imgW = (width - gap * 2) / 3;
  const imgH = Math.round(imgW * 0.68);

  const avgRating = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
    : 5;

  // Split "Used by Skydiver Man" → "Used by " + brand bold
  const parts = title.split('Skydiver Man');
  const hasHighlight = parts.length === 2;

  return (
    <View style={styles.gallerySection}>
      {/* Title with bold brand name */}
      <View style={styles.galleryTitleRow}>
        {hasHighlight ? (
          <Text style={styles.galleryTitle}>
            {parts[0]}
            <Text style={styles.galleryTitleBold}>Skydiver Man</Text>
            {parts[1]}
          </Text>
        ) : (
          <Text style={styles.galleryTitle}>{title}</Text>
        )}
      </View>

      {/* Star row */}
      <View style={styles.galleryStars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            color={colors.gold}
            fill={i < avgRating ? colors.gold : 'transparent'}
            strokeWidth={1}
          />
        ))}
      </View>

      {/* Full-width image strip — no outer padding, matches reference */}
      <View style={[styles.galleryRow, { gap }]}>
        {GALLERY_IMAGES.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={[styles.galleryImage, { width: imgW, height: imgH }]}
            resizeMode="cover"
          />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 8 },

  // ── Featured Section ──────────────────────────────────────────────────────
  featuredSection: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 7,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllDots: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  seeAllDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  featuredGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  carouselContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 10,
  },
  featuredCard: {
    width: 124,
    backgroundColor: '#0D1E35',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.18)',
    overflow: 'hidden',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  featuredCardImageWrap: {
    width: '100%',
    height: 90,
    backgroundColor: '#0A1628',
    overflow: 'hidden',
    position: 'relative',
  },
  featuredCardImage: {
    objectFit: 'cover',
  } as any,
  featuredCardInfo: {
    padding: 6,
    gap: 2,
  },
  featuredCardName: {
    color: '#E8F4FD',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  featuredCardPrice: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },
  featuredHeartBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(6,12,24,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  featuredCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  featuredCartBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,191,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtn: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: 4,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  viewBtnText: {
    color: '#050A14',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  // ── Canopy Finder ─────────────────────────────────────────────────────────
  canopySection: {
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.22)',
    backgroundColor: '#0D1830',
  },
  canopyInner: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  canopyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  canopyIcon: {
    width: 34,
    height: 34,
  },
  canopyTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    fontStyle: 'italic',
  },
  canopyFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  canopyFieldLabel: {
    color: '#A8C8E0',
    fontSize: 12,
    fontWeight: '400',
  },
  canopyValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  canopyValueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 38,
    padding: 0,
  },
  canopyValueUnit: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  canopyDivider: {
    height: 1,
    backgroundColor: 'rgba(0,191,255,0.12)',
    marginVertical: 2,
  },
  canopyBtn: {
    borderRadius: Radius.full,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  canopyBtnText: {
    color: '#050A14',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // ── Gallery ───────────────────────────────────────────────────────────────
  gallerySection: {
    marginTop: 18,
  },
  galleryTitleRow: {
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  galleryTitle: {
    color: '#C8DFF0',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  galleryTitleBold: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  galleryStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 10,
  },
  galleryRow: {
    flexDirection: 'row',
  },
  galleryImage: {
    borderRadius: 6,
    objectFit: 'cover',
  } as any,
});
