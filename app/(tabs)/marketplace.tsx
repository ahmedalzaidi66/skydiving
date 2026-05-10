import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, TriangleAlert as AlertTriangle, Tag, Package, Star, BadgeCheck, Eye, Zap, Heart } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useGearWishlist } from '@/context/GearWishlistContext';
import AppHeader from '@/components/AppHeader';
import SearchBar from '@/components/SearchBar';
import { Spacing, FontSize, Radius } from '@/constants/theme';
import { useTheme, useThemeColors } from '@/context/ThemeContext';

export type UsedGearListing = {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  category: string;
  price: number;
  condition: string;
  description: string;
  contact: string;
  images: string[];
  status: string;
  admin_note: string;
  created_at: string;
  seller_verified: boolean;
  make: string;
  model: string;
  color: string;
  size: string;
  dom: string;
  serial_number: string;
  total_jumps: number | null;
  location: string;
  shipping_included: boolean;
  main_make: string;
  main_model: string;
  main_size: string;
  main_dom: string;
  main_jumps: number | null;
  main_serial: string;
  reserve_make: string;
  reserve_model: string;
  reserve_size: string;
  reserve_dom: string;
  reserve_repacks: number | null;
  reserve_serial: string;
  aad_make: string;
  aad_model: string;
  aad_dom: string;
  aad_eol: string;
  aad_jumps: number | null;
  aad_needs_service: boolean;
  aad_serial: string;
  main_image_url: string | null;
  view_count?: number;
};

type SellerRatingSummary = {
  user_id: string;
  avg_rating: number;
  rating_count: number;
  is_verified: boolean;
};

// These are intentionally static — condition colors are semantic and don't change with theme
const CONDITION_COLORS: Record<string, string> = {
  new:      '#00E676',
  like_new: '#00E676',
  good:     '#00BFFF',
  fair:     '#FFB300',
  poor:     '#FF4444',
};

const SORT_OPTIONS = ['newest', 'priceLowHigh', 'priceHighLow'] as const;
type SortKey = typeof SORT_OPTIONS[number];
type AvailFilter = 'all' | 'available';

const PAGE_SIZE = 10;

function isBoosted(_listing: UsedGearListing): boolean {
  return false;
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { gearWishlistIds } = useGearWishlist();
  const C = useThemeColors();
  const ms = getMsStyles(C);

  const [listings, setListings] = useState<UsedGearListing[]>([]);
  const [allListings, setAllListings] = useState<UsedGearListing[]>([]);
  const [sellerMap, setSellerMap] = useState<Record<string, SellerRatingSummary>>({});
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const [availFilter, setAvailFilter] = useState<AvailFilter>('available');

  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchingRef = useRef(false);
  const pageRef = useRef(0);

  const buildQuery = useCallback((offset: number, category: string | null, sortKey: SortKey, avail: AvailFilter) => {
    let q = supabase
      .from('used_gear_listings')
      .select('*')
      .in('status', avail === 'available' ? ['approved'] : ['approved', 'sold']);

    if (category) q = q.eq('category', category);

    if (sortKey === 'priceLowHigh') q = q.order('price', { ascending: true });
    else if (sortKey === 'priceHighLow') q = q.order('price', { ascending: false });
    else q = q.order('created_at', { ascending: false });

    return q.range(offset, offset + PAGE_SIZE - 1);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setRawSearch(text);
    if (text.trim()) setLoadingSearch(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(text.trim());
      setLoadingSearch(false);
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setRawSearch('');
    setSearchQuery('');
    setLoadingSearch(false);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const loadSellerProfiles = useCallback(async (rows: UsedGearListing[]) => {
    const sellerIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    if (sellerIds.length === 0) return;
    const { data: profiles } = await supabase
      .from('seller_profiles')
      .select('user_id, avg_rating, rating_count, is_verified')
      .in('user_id', sellerIds);
    const map: Record<string, SellerRatingSummary> = {};
    for (const p of (profiles ?? []) as SellerRatingSummary[]) map[p.user_id] = p;
    setSellerMap((prev) => ({ ...prev, ...map }));
  }, []);

  const loadAllListings = useCallback(async (avail: AvailFilter) => {
    if (allListings.length > 0) return;
    const { data } = await supabase
      .from('used_gear_listings')
      .select('*')
      .in('status', avail === 'available' ? ['approved'] : ['approved', 'sold'])
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as UsedGearListing[];
    setAllListings(rows);
    await loadSellerProfiles(rows);
  }, [allListings.length, loadSellerProfiles]);

  const resetAndLoad = useCallback(async (category: string | null, sortKey: SortKey, avail: AvailFilter) => {
    fetchingRef.current = false;
    pageRef.current = 0;
    setLoading(true);
    setListings([]);
    setAllListings([]);
    setHasMore(true);

    const { data } = await buildQuery(0, category, sortKey, avail);
    const rows = (data ?? []) as UsedGearListing[];

    if (!category) {
      const { data: allRows } = await supabase
        .from('used_gear_listings')
        .select('category')
        .in('status', ['approved', 'sold']);
      const cats = Array.from(new Set((allRows ?? []).map((r: any) => r.category).filter(Boolean)));
      setAllCategories(cats);
    }

    setListings(rows);
    setHasMore(rows.length === PAGE_SIZE);
    pageRef.current = 1;
    setLoading(false);
    await loadSellerProfiles(rows);
  }, [buildQuery, loadSellerProfiles]);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore || searchQuery) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const offset = pageRef.current * PAGE_SIZE;
      const { data } = await buildQuery(offset, selectedCategory, sort, availFilter);
      const rows = (data ?? []) as UsedGearListing[];
      setListings((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      pageRef.current += 1;
      await loadSellerProfiles(rows);
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, buildQuery, selectedCategory, sort, availFilter, loadSellerProfiles]);

  useEffect(() => {
    resetAndLoad(selectedCategory, sort, availFilter);
  }, [selectedCategory, sort, availFilter, resetAndLoad]);

  useEffect(() => {
    if (searchQuery) {
      loadAllListings(availFilter);
    }
  }, [searchQuery, availFilter, loadAllListings]);

  const displayedListings = useMemo(() => {
    if (!searchQuery) return listings;
    const q = searchQuery.toLowerCase();
    const pool = allListings.length > 0 ? allListings : listings;
    return pool.filter((l) => {
      const cat = selectedCategory ? l.category === selectedCategory : true;
      const avail = availFilter === 'available' ? l.status !== 'sold' : true;
      if (!cat || !avail) return false;
      // Price: match plain number string and formatted "$1,234"
      const price = l.price != null ? String(l.price) : '';
      const priceFmt = l.price != null ? Number(l.price).toLocaleString() : '';
      return (
        (l.title ?? '').toLowerCase().includes(q) ||
        (l.category ?? '').toLowerCase().includes(q) ||
        (l.make ?? '').toLowerCase().includes(q) ||
        (l.model ?? '').toLowerCase().includes(q) ||
        (l.main_make ?? '').toLowerCase().includes(q) ||
        (l.main_model ?? '').toLowerCase().includes(q) ||
        (l.reserve_make ?? '').toLowerCase().includes(q) ||
        (l.reserve_model ?? '').toLowerCase().includes(q) ||
        (l.aad_make ?? '').toLowerCase().includes(q) ||
        (l.aad_model ?? '').toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q) ||
        price.includes(q) ||
        priceFmt.includes(q)
      );
    });
  }, [searchQuery, listings, allListings, selectedCategory, availFilter]);

  const isSearching = searchQuery.length > 0;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await resetAndLoad(selectedCategory, sort, availFilter);
    setRefreshing(false);
  }, [resetAndLoad, selectedCategory, sort, availFilter]);

  const sortLabel = (k: SortKey) => {
    if (k === 'newest') return t.newest;
    if (k === 'priceLowHigh') return t.priceLowHigh;
    return t.priceHighLow;
  };

  const renderFooter = () => {
    if (!isSearching && loadingMore) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={C.neonBlue} />
        </View>
      );
    }
    if (!isSearching && !hasMore && listings.length > 0) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 24, gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600', letterSpacing: 0.5 }}>No more listings</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <AppHeader title={t.usedGear} />

      {/* Safety banner */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,179,0,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,179,0,0.2)', paddingHorizontal: Spacing.md, paddingVertical: 10 }}>
        <AlertTriangle size={14} color={C.warning} strokeWidth={2} />
        <Text style={{ flex: 1, color: C.warning, fontSize: FontSize.xs, fontWeight: '600', lineHeight: 16 }}>{t.usedGearSafetyWarning}</Text>
      </View>

      {/* Search bar */}
      <View style={ms.searchWrap}>
        <SearchBar
          value={rawSearch}
          onChangeText={handleSearchChange}
          placeholder={t.searchGear ?? 'Search gear, make, model…'}
        />
      </View>

      {/* Search meta row */}
      {isSearching && !loading && (
        <View style={ms.searchMeta}>
          {loadingSearch ? (
            <ActivityIndicator size="small" color={C.neonBlue} style={{ marginRight: 6 }} />
          ) : (
            <Text style={ms.searchMetaText}>
              {displayedListings.length === 0
                ? (t.noResultsFor ?? 'No results for') + ` "${searchQuery}"`
                : `${displayedListings.length} ${displayedListings.length === 1 ? 'result' : 'results'} for "${searchQuery}"`}
            </Text>
          )}
          <TouchableOpacity onPress={clearSearch} activeOpacity={0.7} style={ms.searchMetaClear}>
            <Text style={ms.searchMetaClearText}>{t.clearSearch ?? 'Clear'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filters row */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: C.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, alignItems: 'center' }}
        >
          <TouchableOpacity
            style={[
              { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.backgroundCard },
              !selectedCategory && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
            ]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.75}
          >
            <Text style={[{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }, !selectedCategory && { color: C.neonBlue, fontWeight: '700' }]}>
              {t.filterAll}
            </Text>
          </TouchableOpacity>
          {allCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.backgroundCard },
                selectedCategory === cat && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
              ]}
              onPress={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              activeOpacity={0.75}
            >
              <Text style={[{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }, selectedCategory === cat && { color: C.neonBlue, fontWeight: '700' }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={{ width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 4 }} />

          <TouchableOpacity
            style={[
              { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.backgroundCard },
              availFilter === 'available' && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
            ]}
            onPress={() => setAvailFilter('available')}
            activeOpacity={0.75}
          >
            <Text style={[{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }, availFilter === 'available' && { color: C.neonBlue, fontWeight: '700' }]}>
              Available
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.backgroundCard },
              availFilter === 'all' && { backgroundColor: C.neonBlueGlow, borderColor: C.neonBlueBorder },
            ]}
            onPress={() => setAvailFilter('all')}
            activeOpacity={0.75}
          >
            <Text style={[{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }, availFilter === 'all' && { color: C.neonBlue, fontWeight: '700' }]}>
              + Sold
            </Text>
          </TouchableOpacity>

          <View style={{ width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 4 }} />

          {SORT_OPTIONS.map((sk) => (
            <TouchableOpacity
              key={sk}
              style={[
                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderLight, backgroundColor: C.backgroundCard },
                sort === sk && { backgroundColor: C.gold + '1A', borderColor: C.gold + '59' },
              ]}
              onPress={() => setSort(sk)}
              activeOpacity={0.75}
            >
              <Text style={[{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }, sort === sk && { color: C.neonBlue, fontWeight: '700' }]}>
                {sortLabel(sk)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={ms.loadingWrap}>
          <ActivityIndicator color={C.neonBlue} size="large" />
          <Text style={ms.loadingText}>{t.loading ?? 'Loading…'}</Text>
        </View>
      ) : displayedListings.length === 0 ? (
        <View style={ms.emptyWrap}>
          <View style={ms.emptyIconWrap}>
            <Package size={36} color={C.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={ms.emptyTitle}>
            {isSearching ? (t.noResultsFor ?? 'No results for') + ` "${searchQuery}"` : t.noListingsFound}
          </Text>
          <Text style={ms.emptySubtext}>
            {isSearching
              ? (t.tryDifferentSearch ?? 'Try a different keyword or adjust filters')
              : t.noListingsSubtitle}
          </Text>
          {isSearching && (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.75} style={ms.clearBtn}>
              <Text style={ms.clearBtnText}>{t.clearSearch ?? 'Clear search'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayedListings}
          keyExtractor={(item) => item.id}
          extraData={gearWishlistIds}
          numColumns={Platform.OS === 'web' ? 2 : 1}
          key={Platform.OS === 'web' ? 'web-2col' : 'mobile-1col'}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.neonBlue}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              seller={sellerMap[item.user_id] ?? null}
              onPress={() => router.push({ pathname: '/marketplace/[id]', params: { id: item.id } } as any)}
            />
          )}
        />
      )}

      {/* FAB — post a listing */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/marketplace/create' as any)}
        activeOpacity={0.8}
      >
        <Plus size={26} color="#050A14" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function ListingCard({
  listing,
  seller,
  onPress,
}: {
  listing: UsedGearListing;
  seller: SellerRatingSummary | null;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const { isGearWishlisted, toggleGear } = useGearWishlist();
  const { preset: themePreset } = useTheme();
  const C = useThemeColors();
  const isLight = themePreset === 'light';
  const thumb = listing.main_image_url || listing.images?.[0];
  const condColor = CONDITION_COLORS[listing.condition] ?? C.textMuted;
  const condLabelText = conditionLabel(listing.condition, t);
  const isVerified = listing.seller_verified || seller?.is_verified;
  const isSold = listing.status === 'sold';
  const boosted = isBoosted(listing);
  const views = listing.view_count ?? 0;
  const wishlisted = isGearWishlisted(listing.id);

  return (
    <TouchableOpacity
      style={[
        { flex: 1, backgroundColor: C.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isLight ? 0.10 : 0.35, shadowRadius: 8, elevation: 3, marginHorizontal: Platform.OS === 'web' ? Spacing.xs : 0, marginBottom: Platform.OS === 'web' ? Spacing.xs : 0 },
        isSold && { opacity: 0.72, borderColor: C.borderLight },
        boosted && { borderColor: C.gold + '80', shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 10 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {boosted && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold + '1A', borderBottomWidth: 1, borderBottomColor: C.gold + '40', paddingHorizontal: Spacing.sm, paddingVertical: 5 }}>
          <Zap size={10} color={C.gold} strokeWidth={2.5} fill={C.gold} />
          <Text style={{ color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>FEATURED</Text>
        </View>
      )}

      <View style={{ width: '100%', height: 180, backgroundColor: isLight ? '#F0F4F8' : C.backgroundSecondary, position: 'relative' }}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={[StyleSheet.absoluteFillObject, isSold && { opacity: 0.55 }]} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isLight ? '#F0F4F8' : C.backgroundSecondary }}>
            <Tag size={32} color={C.textMuted} strokeWidth={1.5} />
          </View>
        )}
        {isSold && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,20,0.55)', justifyContent: 'center', alignItems: 'center' } as any}>
            <Text style={{ color: '#FFFFFF', fontSize: FontSize.xl, fontWeight: '900', letterSpacing: 4, opacity: 0.9 }}>SOLD</Text>
          </View>
        )}
        {!isSold && (
          <View style={{ position: 'absolute', top: 10, right: 10, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderColor: condColor, backgroundColor: 'rgba(5,10,20,0.75)' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: condColor }}>{condLabelText}</Text>
          </View>
        )}
        {isVerified && !isSold && (
          <View style={{ position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(5,10,20,0.82)', borderRadius: Radius.full, borderWidth: 1, borderColor: C.neonBlueBorder, paddingHorizontal: 7, paddingVertical: 3 }}>
            <BadgeCheck size={11} color={C.neonBlue} strokeWidth={2.5} />
            <Text style={{ color: C.neonBlue, fontSize: 9, fontWeight: '800', letterSpacing: 0.2 }}>{t.verifiedSeller}</Text>
          </View>
        )}
        {views > 0 && (
          <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(5,10,20,0.65)', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Eye size={10} color="rgba(255,255,255,0.75)" strokeWidth={2} />
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '700' }}>{views}</Text>
          </View>
        )}
        {!isSold && (
          <TouchableOpacity
            style={[
              { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(5,10,20,0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
              isLight && { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(0,0,0,0.10)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
            ]}
            onPress={(e) => { e.stopPropagation?.(); toggleGear(listing); }}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Heart
              size={16}
              color={wishlisted ? '#FF4444' : (isLight ? C.neonBlueDim : 'rgba(255,255,255,0.85)')}
              fill={wishlisted ? '#FF4444' : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ padding: Spacing.md, gap: 4 }}>
        <Text style={[{ color: C.textPrimary, fontSize: FontSize.md, fontWeight: '700', lineHeight: 20 }, isSold && { color: C.textMuted, textDecorationLine: 'line-through' }]} numberOfLines={2}>{listing.title}</Text>
        {listing.category ? (
          <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1 }}>{listing.category.toUpperCase()}</Text>
        ) : null}

        {seller && seller.rating_count > 0 && !isSold && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((sv) => (
              <Star
                key={sv}
                size={11}
                color={sv <= Math.round(seller.avg_rating) ? C.gold : C.textMuted}
                fill={sv <= Math.round(seller.avg_rating) ? C.gold : 'transparent'}
                strokeWidth={1.5}
              />
            ))}
            <Text style={{ color: C.gold, fontSize: FontSize.xs, fontWeight: '700', marginLeft: 3 }}>
              {Number(seller.avg_rating).toFixed(1)}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={[{ color: C.neonBlue, fontSize: FontSize.lg, fontWeight: '900' }, isSold && { color: C.textMuted, textDecorationLine: 'line-through' }]}>
            ${Number(listing.price).toLocaleString()}
          </Text>
          {isSold ? (
            <View style={{ backgroundColor: C.errorDim, borderRadius: Radius.full, borderWidth: 1, borderColor: C.error, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: C.error, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>SOLD</Text>
            </View>
          ) : (
            <Text style={{ color: C.textMuted, fontSize: FontSize.xs }}>
              {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function conditionLabel(cond: string, t: any): string {
  const map: Record<string, string> = {
    new:      t.conditionNew,
    like_new: t.conditionLikeNew,
    good:     t.conditionGood,
    fair:     t.conditionFair,
    poor:     t.conditionPoor,
  };
  return map[cond] ?? cond;
}

export { conditionLabel, CONDITION_COLORS };

function getMsStyles(C: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    searchWrap: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: C.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
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
    loadingWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      color: C.textMuted,
      fontSize: FontSize.sm,
    },
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
    clearBtn: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: C.neonBlueBorder,
      borderRadius: Radius.full,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    clearBtnText: {
      color: C.neonBlue,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
  });
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#00BFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10,
  },
});
