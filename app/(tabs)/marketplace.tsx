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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, TriangleAlert as AlertTriangle, Tag, Package, Star, BadgeCheck, Eye, Zap, Heart, Search, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useGearWishlist } from '@/context/GearWishlistContext';
import AppHeader from '@/components/AppHeader';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

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
};

type SellerRatingSummary = {
  user_id: string;
  avg_rating: number;
  rating_count: number;
  is_verified: boolean;
};

const CONDITION_COLORS: Record<string, string> = {
  new:      Colors.success,
  like_new: '#00E676',
  good:     Colors.neonBlue,
  fair:     Colors.warning,
  poor:     Colors.error,
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
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(text.trim()), 300);
  }, []);

  const clearSearch = useCallback(() => {
    setRawSearch('');
    setSearchQuery('');
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

    // Load all categories on first/reset fetch for filter chips
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
      return (
        (l.title ?? '').toLowerCase().includes(q) ||
        (l.category ?? '').toLowerCase().includes(q) ||
        (l.make ?? '').toLowerCase().includes(q) ||
        (l.model ?? '').toLowerCase().includes(q) ||
        (l.main_make ?? '').toLowerCase().includes(q) ||
        (l.main_model ?? '').toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q)
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
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.neonBlue} />
        </View>
      );
    }
    if (!isSearching && !hasMore && listings.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <View style={styles.footerEndLine} />
          <Text style={styles.footerEndText}>No more listings</Text>
          <View style={styles.footerEndLine} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t.usedGear} />

      {/* Safety banner */}
      <View style={styles.safetyBanner}>
        <AlertTriangle size={14} color={Colors.warning} strokeWidth={2} />
        <Text style={styles.safetyText}>{t.usedGearSafetyWarning}</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={15} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search gear, make, model…"
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

      {/* Filters row */}
      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
              {t.filterAll}
            </Text>
          </TouchableOpacity>
          {allCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.chipDivider} />

          <TouchableOpacity
            style={[styles.chip, availFilter === 'available' && styles.chipActive]}
            onPress={() => setAvailFilter('available')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, availFilter === 'available' && styles.chipTextActive]}>
              Available
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, availFilter === 'all' && styles.chipActive]}
            onPress={() => setAvailFilter('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, availFilter === 'all' && styles.chipTextActive]}>
              + Sold
            </Text>
          </TouchableOpacity>

          <View style={styles.chipDivider} />

          {SORT_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, styles.chipSort, sort === s && styles.chipSortActive]}
              onPress={() => setSort(s)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, sort === s && styles.chipTextActive]}>
                {sortLabel(s)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : displayedListings.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={48} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>
            {isSearching ? `No results for "${searchQuery}"` : t.noListingsFound}
          </Text>
          {isSearching ? (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.75} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchBtnText}>Clear search</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptySubtitle}>{t.noListingsSubtitle}</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={displayedListings}
          keyExtractor={(item) => item.id}
          extraData={gearWishlistIds}
          numColumns={Platform.OS === 'web' ? 2 : 1}
          key={Platform.OS === 'web' ? 'web-2col' : 'mobile-1col'}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.neonBlue}
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
        style={styles.fab}
        onPress={() => router.push('/marketplace/create' as any)}
        activeOpacity={0.8}
      >
        <Plus size={26} color={Colors.background} strokeWidth={2.5} />
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
  const thumb = listing.main_image_url || listing.images?.[0];
  const condColor = CONDITION_COLORS[listing.condition] ?? Colors.textMuted;
  const condLabel = conditionLabel(listing.condition, t);
  const isVerified = listing.seller_verified || seller?.is_verified;
  const isSold = listing.status === 'sold';
  const boosted = isBoosted(listing);
  const views = listing.view_count ?? 0;
  const wishlisted = isGearWishlisted(listing.id);

  return (
    <TouchableOpacity
      style={[styles.card, isSold && styles.cardSold, boosted && styles.cardBoosted]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {boosted && (
        <View style={styles.boostRibbon}>
          <Zap size={10} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
          <Text style={styles.boostRibbonText}>FEATURED</Text>
        </View>
      )}

      <View style={styles.cardImageWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={[styles.cardImage, isSold && styles.cardImageSold]} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Tag size={32} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
        )}
        {isSold && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldOverlayText}>SOLD</Text>
          </View>
        )}
        {!isSold && (
          <View style={[styles.condBadge, { borderColor: condColor }]}>
            <Text style={[styles.condBadgeText, { color: condColor }]}>{condLabel}</Text>
          </View>
        )}
        {isVerified && !isSold && (
          <View style={styles.verifiedOverlay}>
            <BadgeCheck size={11} color={Colors.neonBlue} strokeWidth={2.5} />
            <Text style={styles.verifiedOverlayText}>{t.verifiedSeller}</Text>
          </View>
        )}
        {views > 0 && (
          <View style={styles.viewCountBadge}>
            <Eye size={10} color="rgba(255,255,255,0.75)" strokeWidth={2} />
            <Text style={styles.viewCountText}>{views}</Text>
          </View>
        )}
        {!isSold && (
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={(e) => { e.stopPropagation?.(); toggleGear(listing); }}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Heart
              size={16}
              color={wishlisted ? Colors.error : 'rgba(255,255,255,0.85)'}
              fill={wishlisted ? Colors.error : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, isSold && styles.cardTitleSold]} numberOfLines={2}>{listing.title}</Text>
        {listing.category ? (
          <Text style={styles.cardCategory}>{listing.category.toUpperCase()}</Text>
        ) : null}

        {seller && seller.rating_count > 0 && !isSold && (
          <View style={styles.cardRatingRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={11}
                color={s <= Math.round(seller.avg_rating) ? Colors.gold : Colors.textMuted}
                fill={s <= Math.round(seller.avg_rating) ? Colors.gold : 'transparent'}
                strokeWidth={1.5}
              />
            ))}
            <Text style={styles.cardRatingText}>
              {Number(seller.avg_rating).toFixed(1)}
            </Text>
          </View>
        )}

        <View style={styles.cardBottom}>
          <Text style={[styles.cardPrice, isSold && styles.cardPriceSold]}>${Number(listing.price).toLocaleString()}</Text>
          {isSold ? (
            <View style={styles.soldBadge}>
              <Text style={styles.soldBadgeText}>SOLD</Text>
            </View>
          ) : (
            <Text style={styles.cardDate}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,179,0,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
    margin: 0,
  },
  clearSearchBtn: {
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 4,
  },
  clearSearchBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  safetyText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  filtersWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  chipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  chipSort: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSortActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: 'rgba(255,215,0,0.35)',
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
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
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
    marginHorizontal: Platform.OS === 'web' ? Spacing.xs : 0,
    marginBottom: Platform.OS === 'web' ? Spacing.xs : 0,
  },
  cardBoosted: {
    borderColor: 'rgba(255,215,0,0.5)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  boostRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.3)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  boostRibbonText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  cardImageWrap: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.background,
    position: 'relative',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  condBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(5,10,20,0.75)',
  },
  condBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardBody: {
    padding: Spacing.md,
    gap: 4,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  cardCategory: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  verifiedOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verifiedOverlayText: {
    color: Colors.neonBlue,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  viewCountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(5,10,20,0.65)',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  viewCountText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(5,10,20,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardRatingText: {
    color: Colors.gold,
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginLeft: 3,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  cardDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.neonBlue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10,
  },
  cardSold: {
    opacity: 0.72,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardImageSold: {
    opacity: 0.55,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,20,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOverlayText: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '900',
    letterSpacing: 4,
    opacity: 0.9,
  },
  soldBadge: {
    backgroundColor: 'rgba(255,68,68,0.18)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soldBadgeText: {
    color: Colors.error,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitleSold: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  cardPriceSold: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
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
