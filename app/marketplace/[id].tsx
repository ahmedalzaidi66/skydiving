import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
  TextInput,
  Modal,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Phone,
  MessageCircle,
  TriangleAlert as AlertTriangle,
  Tag,
  ChevronLeft,
  ChevronRight,
  Star,
  BadgeCheck,
  Calendar,
  Package,
  ShieldCheck,
  MapPin,
  Truck,
  Eye,
  Zap,
  Flag,
  X,
  CircleCheck,
  Heart,
  Share2,
} from 'lucide-react-native';
import { supabase, toThumbUrl, toFullUrl } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useGearWishlist } from '@/context/GearWishlistContext';
import { Spacing, FontSize, Radius } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { conditionLabel, CONDITION_COLORS, UsedGearListing } from '@/app/(tabs)/marketplace';

type SellerProfile = {
  user_id: string;
  is_verified: boolean;
  total_listings: number;
  join_date: string;
  avg_rating: number;
  rating_count: number;
};

type BoostSettings = {
  price: number;
  durationDays: number;
};

const RIG_CATEGORIES = ['complete_rig', 'parachute_rig'];

const REPORT_REASONS = [
  { value: 'scam',            label: 'Scam / احتيال' },
  { value: 'fake_item',       label: 'Fake item / منتج مزيف' },
  { value: 'wrong_info',      label: 'Wrong information / معلومات غير صحيحة' },
  { value: 'unsafe',          label: 'Unsafe item / منتج غير آمن' },
  { value: 'suspicious_seller', label: 'Suspicious seller / بائع مشبوه' },
  { value: 'other',           label: 'Other / أخرى' },
];

function isBoosted(_listing: UsedGearListing): boolean {
  return false;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isGearWishlisted, toggleGear } = useGearWishlist();
  const C = useThemeColors();

  const [listing, setListing] = useState<UsedGearListing | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [myRating, setMyRating] = useState<number>(0);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [ratingMsg, setRatingMsg] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<'listing' | 'seller'>('listing');
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState('');

  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostSettings, setBoostSettings] = useState<BoostSettings>({ price: 9.99, durationDays: 7 });
  const [boostSubmitting, setBoostSubmitting] = useState(false);
  const [boostDone, setBoostDone] = useState(false);
  const [existingBoostStatus, setExistingBoostStatus] = useState<string | null>(null);

  const [shareCopied, setShareCopied] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const viewTracked = useRef(false);
  const fetchId = useRef(0);

  useEffect(() => {
    if (!id) return;

    const thisFetch = ++fetchId.current;
    viewTracked.current = false;

    setLoading(true);
    setFetchError(null);
    setListing(null);
    setSeller(null);
    setMyRating(0);
    setExistingRating(null);
    setExistingBoostStatus(null);

    const timeoutId = setTimeout(() => {
      if (thisFetch !== fetchId.current) return;
      setFetchError('Request timed out. Please check your connection and try again.');
      setLoading(false);
    }, 8000);

    supabase
      .from('used_gear_listings')
      .select('id, title, price, description, condition, category, location, contact, status, user_id, images, main_image_url, shipping_included, seller_verified, created_at, make, model, size, color, dom, serial_number, total_jumps, main_make, main_model, main_size, main_dom, main_jumps, main_serial, reserve_make, reserve_model, reserve_size, reserve_dom, reserve_repacks, reserve_serial, aad_make, aad_model, aad_dom, aad_eol, aad_jumps, aad_needs_service, aad_serial')
      .eq('id', id)
      .maybeSingle()
      .then(({ data: listingData, error: listingError }) => {
        if (thisFetch !== fetchId.current) return;
        clearTimeout(timeoutId);

        if (listingError) {
          setFetchError(listingError.message);
          setLoading(false);
          return;
        }

        const l = listingData as UsedGearListing | null;
        setListing(l);
        setLoading(false);

        if (!l) return;

        if (user) {
          supabase
            .from('seller_ratings')
            .select('stars')
            .eq('listing_id', id)
            .eq('rater_id', user.id)
            .maybeSingle()
            .then(({ data: ratingData }) => {
              if (thisFetch !== fetchId.current) return;
              if (ratingData) {
                setExistingRating((ratingData as any).stars);
                setMyRating((ratingData as any).stars);
              }
            })
            .catch(() => {});
        }

        if (l.user_id) {
          supabase
            .from('seller_profiles')
            .select('user_id, is_verified, total_listings, join_date, avg_rating, rating_count')
            .eq('user_id', l.user_id)
            .maybeSingle()
            .then(({ data }) => {
              if (thisFetch !== fetchId.current) return;
              setSeller(data as SellerProfile | null);
            })
            .catch(() => {});
        }

        supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['boost_price_usd', 'boost_duration_days'])
          .then(({ data }) => {
            if (!data || thisFetch !== fetchId.current) return;
            const map: Record<string, string> = {};
            for (const r of data as { key: string; value: string }[]) map[r.key] = r.value;
            setBoostSettings({
              price: parseFloat(map['boost_price_usd'] ?? '9.99'),
              durationDays: parseInt(map['boost_duration_days'] ?? '7', 10),
            });
          })
          .catch(() => {});

        const viewerKey = user?.id
          ? `user_${user.id}`
          : `anon_${Platform.OS}_${Date.now().toString(36).slice(-6)}`;
        supabase.from('listing_views').insert({ listing_id: l.id, viewer_key: viewerKey }).then(() => {});
        viewTracked.current = true;
      })
      .catch((err: any) => {
        if (thisFetch !== fetchId.current) return;
        clearTimeout(timeoutId);
        setFetchError(err?.message ?? 'Failed to load listing');
        setLoading(false);
      });
  }, [id]);

  const handleRate = async (stars: number) => {
    if (!user) { setRatingMsg(t.signInToRate); return; }
    if (existingRating !== null) { setRatingMsg(t.alreadyRated); return; }
    if (!listing) return;

    setMyRating(stars);
    setSubmittingRating(true);
    const { error } = await supabase.from('seller_ratings').insert({
      listing_id: listing.id,
      rater_id: user.id,
      seller_id: listing.user_id,
      stars,
    });
    setSubmittingRating(false);

    if (error) {
      if (error.code === '23505') {
        setRatingMsg(t.alreadyRated);
        setExistingRating(stars);
      } else {
        setRatingMsg(t.ratingFailed);
        setMyRating(0);
      }
    } else {
      setExistingRating(stars);
      setRatingMsg(t.ratingSaved);
      if (listing.user_id) {
        const { data } = await supabase
          .from('seller_profiles')
          .select('user_id, is_verified, total_listings, join_date, avg_rating, rating_count')
          .eq('user_id', listing.user_id)
          .maybeSingle();
        setSeller(data as SellerProfile | null);
      }
    }
    setTimeout(() => setRatingMsg(''), 3000);
  };

  const handleSubmitReport = async () => {
    if (!user) { setReportError('You must be signed in to submit a report.'); return; }
    if (!reportReason) { setReportError('Please select a reason.'); return; }
    setReportSubmitting(true);
    setReportError('');
    const { error } = await supabase.from('used_gear_reports').insert({
      listing_id: listing!.id,
      reported_user_id: listing!.user_id ?? null,
      reporter_user_id: user.id,
      reason: reportReason,
      note: reportNote.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      if (error.code === '23505') {
        setReportError('You have already reported this listing for that reason.');
      } else {
        setReportError('Failed to submit report. Please try again.');
      }
    } else {
      setReportDone(true);
      setTimeout(() => setShowReportModal(false), 2500);
    }
  };

  const openReport = (target: 'listing' | 'seller') => {
    setReportTarget(target);
    setReportDone(false);
    setReportError('');
    setReportReason('');
    setReportNote('');
    setShowReportModal(true);
  };

  const handleRequestBoost = async () => {
    if (!user) return;
    setBoostSubmitting(true);
    const { error } = await supabase.from('listing_boosts').insert({
      listing_id: listing!.id,
      user_id: user.id,
      status: 'pending_payment',
      price_paid: boostSettings.price,
      duration_days: boostSettings.durationDays,
    });
    setBoostSubmitting(false);
    if (!error) {
      setBoostDone(true);
      setExistingBoostStatus('pending_payment');
      setTimeout(() => setShowBoostModal(false), 2000);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.neonBlue} size="large" />
      </View>
    );
  }

  if (fetchError || !listing) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: fetchError ? C.error : C.textMuted, fontSize: FontSize.md }}>
          {fetchError ?? 'Listing not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} style={{ marginTop: 12 }}>
          <Text style={{ color: C.neonBlue, fontSize: FontSize.sm, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rawImages = listing.images ?? [];
  const allImages = listing.main_image_url && !rawImages.includes(listing.main_image_url)
    ? [listing.main_image_url, ...rawImages]
    : rawImages.length > 0 ? rawImages : listing.main_image_url ? [listing.main_image_url] : [];
  // Use full-res for detail view; thumb for thumbnail strip
  const images = allImages.map(toFullUrl);
  const condColor = CONDITION_COLORS[listing.condition] ?? C.textMuted;
  const isVerified = listing.seller_verified || seller?.is_verified;
  const isRig = RIG_CATEGORIES.includes(listing.category);
  const boosted = isBoosted(listing);
  const isOwner = user?.id === listing.user_id;
  const views = 0;

  const contactRaw = listing.contact?.replace(/\s/g, '') ?? '';
  const isPhone = contactRaw.startsWith('+') || /^\d{6,}/.test(contactRaw);
  const phoneDigits = contactRaw.replace(/[^0-9]/g, '');
  const waMessage = encodeURIComponent("Hi, I'm interested in your item on Skydiver");

  const handleWhatsApp = () => {
    Linking.openURL(`https://wa.me/${phoneDigits}?text=${waMessage}`).catch(() => {});
  };

  const handleCall = () => {
    Linking.openURL(`tel:${contactRaw}`).catch(() => {});
  };

  const wishlisted = isGearWishlisted(listing.id);

  const handleShare = async () => {
    const url = `${(typeof window !== 'undefined' && window?.location?.origin) ? window.location.origin : 'https://skydiverstore.com'}/marketplace/${listing.id}`;
    const message = `Check this out on Skydiver Man Gear: ${listing.title}`;
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ title: listing.title, message: `${message}\n${url}`, url });
      } catch {}
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: listing.title, text: message, url });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Image carousel */}
        <View style={{ width: '100%', height: Platform.OS === 'web' ? 420 : 320, backgroundColor: C.backgroundSecondary, position: 'relative' }}>
          {/* Top action bar */}
          <View style={[s.topBar, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={s.topBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={s.topBtnRow}>
              {!isOwner && (
                <TouchableOpacity
                  style={s.topBtn}
                  onPress={() => toggleGear(listing)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Heart
                    size={20}
                    color={wishlisted ? '#FF4444' : '#FFFFFF'}
                    fill={wishlisted ? '#FF4444' : 'transparent'}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.topBtn}
                onPress={handleShare}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {shareCopied
                  ? <Text style={{ color: C.neonBlue, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>Copied!</Text>
                  : <Share2 size={18} color="#FFFFFF" strokeWidth={2} />
                }
              </TouchableOpacity>
            </View>
          </View>

          {boosted && (
            <View style={s.boostBanner}>
              <Zap size={12} color={C.gold} strokeWidth={2.5} fill={C.gold} />
              <Text style={{ color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>FEATURED LISTING</Text>
            </View>
          )}

          {images.length > 0 ? (
            <>
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject as any}
                onPress={() => setShowLightbox(true)}
                activeOpacity={0.92}
              >
                <Image
                  source={{ uri: images[imgIdx] }}
                  style={StyleSheet.absoluteFillObject as any}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              {images.length > 1 && (
                <>
                  {imgIdx > 0 && (
                    <TouchableOpacity
                      style={[s.imgNav, s.imgNavLeft]}
                      onPress={() => setImgIdx((i) => i - 1)}
                      activeOpacity={0.8}
                    >
                      <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                  {imgIdx < images.length - 1 && (
                    <TouchableOpacity
                      style={[s.imgNav, s.imgNavRight]}
                      onPress={() => setImgIdx((i) => i + 1)}
                      activeOpacity={0.8}
                    >
                      <ChevronRight size={22} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                  <View style={s.imgDots}>
                    {images.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setImgIdx(i)} activeOpacity={0.8}>
                        <View style={[s.dot, i === imgIdx && { backgroundColor: C.neonBlue, width: 18 }]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Tag size={48} color={C.textMuted} strokeWidth={1.5} />
            </View>
          )}

          <View style={[s.condBadge, { borderColor: condColor, backgroundColor: C.background + 'CC' }]}>
            <Text style={[s.condBadgeText, { color: condColor }]}>
              {conditionLabel(listing.condition, t)}
            </Text>
          </View>

          {views > 0 && (
            <View style={s.viewCountChip}>
              <Eye size={12} color={C.textSecondary} strokeWidth={2} />
              <Text style={{ color: C.textSecondary, fontSize: FontSize.xs, fontWeight: '600' }}>{views} views</Text>
            </View>
          )}
        </View>

        <View style={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl }}>
          <Text style={{ color: C.textPrimary, fontSize: FontSize.xl, fontWeight: '800', lineHeight: 28 }}>{listing.title}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
            <Text style={{ color: C.neonBlue, fontSize: FontSize.xxl, fontWeight: '900' }}>
              ${Number(listing.price).toLocaleString()}
            </Text>
            {listing.shipping_included && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.successDim, borderRadius: Radius.full, borderWidth: 1, borderColor: C.success + '4D', paddingHorizontal: 10, paddingVertical: 4 }}>
                <Truck size={12} color={C.success} strokeWidth={2} />
                <Text style={{ color: C.success, fontSize: FontSize.xs, fontWeight: '700' }}>Shipping included</Text>
              </View>
            )}
          </View>

          {listing.category ? (
            <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1.5 }}>
              {listing.category.replace(/_/g, ' ').toUpperCase()}
            </Text>
          ) : null}

          {!!listing.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} color={C.textMuted} strokeWidth={2} />
              <Text style={{ color: C.textMuted, fontSize: FontSize.sm }}>{listing.location}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.warning + '14', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '40', padding: Spacing.sm }}>
            <AlertTriangle size={14} color={C.warning} strokeWidth={2} />
            <Text style={{ flex: 1, color: C.warning, fontSize: FontSize.xs, fontWeight: '600', lineHeight: 17 }}>{t.usedGearSafetyWarning}</Text>
          </View>

          {isOwner && listing.status === 'approved' && (
            <BoostCTA
              boostStatus={existingBoostStatus}
              boostSettings={boostSettings}
              boosted={boosted}
              onPress={() => { setBoostDone(false); setShowBoostModal(true); }}
              C={C}
            />
          )}

          <DetailCard title="Equipment Details" C={C}>
            <DetailRow label="Make" value={listing.make} C={C} />
            <DetailRow label="Model" value={listing.model} C={C} />
            <DetailRow label="Size" value={listing.size} C={C} />
            <DetailRow label="Color" value={listing.color} C={C} />
            <DetailRow label="DOM" value={listing.dom} C={C} />
            <DetailRow label="Serial Number" value={listing.serial_number} C={C} />
            <DetailRow label="Total Jumps" value={listing.total_jumps != null ? String(listing.total_jumps) : ''} C={C} />
          </DetailCard>

          {isRig && (
            <>
              {hasAnyRigField(listing, 'main') && (
                <DetailCard title="Main Canopy" C={C}>
                  <DetailRow label="Make" value={listing.main_make} C={C} />
                  <DetailRow label="Model" value={listing.main_model} C={C} />
                  <DetailRow label="Size" value={listing.main_size} C={C} />
                  <DetailRow label="DOM" value={listing.main_dom} C={C} />
                  <DetailRow label="Jumps" value={listing.main_jumps != null ? String(listing.main_jumps) : ''} C={C} />
                  <DetailRow label="Serial" value={listing.main_serial} C={C} />
                </DetailCard>
              )}

              {hasAnyRigField(listing, 'reserve') && (
                <DetailCard title="Reserve" C={C}>
                  <DetailRow label="Make" value={listing.reserve_make} C={C} />
                  <DetailRow label="Model" value={listing.reserve_model} C={C} />
                  <DetailRow label="Size" value={listing.reserve_size} C={C} />
                  <DetailRow label="DOM" value={listing.reserve_dom} C={C} />
                  <DetailRow label="Repacks" value={listing.reserve_repacks != null ? String(listing.reserve_repacks) : ''} C={C} />
                  <DetailRow label="Serial" value={listing.reserve_serial} C={C} />
                </DetailCard>
              )}

              {hasAnyRigField(listing, 'aad') && (
                <DetailCard title="AAD" C={C}>
                  <DetailRow label="Make" value={listing.aad_make} C={C} />
                  <DetailRow label="Model" value={listing.aad_model} C={C} />
                  <DetailRow label="DOM" value={listing.aad_dom} C={C} />
                  <DetailRow label="EOL" value={listing.aad_eol} C={C} />
                  <DetailRow label="Jumps" value={listing.aad_jumps != null ? String(listing.aad_jumps) : ''} C={C} />
                  <DetailRow label="Needs Service" value={listing.aad_needs_service ? 'Yes' : ''} highlight={listing.aad_needs_service} C={C} />
                  <DetailRow label="Serial" value={listing.aad_serial} C={C} />
                </DetailCard>
              )}
            </>
          )}

          {/* Seller Info */}
          <View style={{ backgroundColor: C.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.sellerInfo}</Text>
              {isVerified && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.neonBlueGlow, borderRadius: Radius.full, borderWidth: 1, borderColor: C.neonBlueBorder, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <BadgeCheck size={13} color={C.neonBlue} strokeWidth={2.5} />
                  <Text style={{ color: C.neonBlue, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 }}>{t.verifiedSeller}</Text>
                </View>
              )}
            </View>
            {seller && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Package size={14} color={C.textMuted} strokeWidth={2} />
                  <Text style={{ color: C.textMuted, fontSize: FontSize.xs }}>{t.totalListings}</Text>
                  <Text style={{ color: C.textPrimary, fontSize: FontSize.xs, fontWeight: '700' }}>{seller.total_listings}</Text>
                </View>
                <View style={{ width: 1, height: 14, backgroundColor: C.border }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Calendar size={14} color={C.textMuted} strokeWidth={2} />
                  <Text style={{ color: C.textMuted, fontSize: FontSize.xs }}>{t.memberSince}</Text>
                  <Text style={{ color: C.textPrimary, fontSize: FontSize.xs, fontWeight: '700' }}>
                    {new Date(seller.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
            )}
            {seller && seller.rating_count > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <StarRow value={seller.avg_rating} size={16} C={C} />
                <Text style={{ color: C.textSecondary, fontSize: FontSize.xs, fontWeight: '600' }}>
                  {Number(seller.avg_rating).toFixed(1)} · {seller.rating_count} {t.ratingStars}
                </Text>
              </View>
            ) : (
              <Text style={{ color: C.textMuted, fontSize: FontSize.xs }}>{t.noRatingsYet}</Text>
            )}
          </View>

          {/* Rate seller */}
          <View style={{ gap: Spacing.sm }}>
            <Text style={{ color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.rateThisSeller}</Text>
            {existingRating !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
                <StarRow value={existingRating} size={22} interactive={false} C={C} />
                <Text style={{ color: C.textMuted, fontSize: FontSize.xs }}>{t.alreadyRated}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => handleRate(s)}
                    activeOpacity={0.7}
                    disabled={submittingRating}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Star
                      size={30}
                      color={s <= myRating ? C.gold : C.textMuted}
                      fill={s <= myRating ? C.gold : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                ))}
                {submittingRating && (
                  <ActivityIndicator size="small" color={C.neonBlue} style={{ marginLeft: 8 }} />
                )}
              </View>
            )}
            {ratingMsg !== '' && <Text style={{ color: C.success, fontSize: FontSize.xs, fontWeight: '600' }}>{ratingMsg}</Text>}
          </View>

          {!!listing.description && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{t.listingDescription}</Text>
              <Text style={{ color: C.textPrimary, fontSize: FontSize.md, lineHeight: 24 }}>{listing.description}</Text>
            </View>
          )}

          <Text style={{ color: C.textMuted, fontSize: FontSize.sm }}>
            {t.postedOn}{' '}
            {new Date(listing.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>

          {!!listing.contact && (
            <View style={{ gap: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.success + '0F', borderRadius: Radius.md, borderWidth: 1, borderColor: C.success + '33', paddingHorizontal: Spacing.sm, paddingVertical: 8 }}>
                <ShieldCheck size={13} color={C.success} strokeWidth={2} />
                <Text style={{ flex: 1, color: C.success, fontSize: FontSize.xs, fontWeight: '600', lineHeight: 16 }}>{t.contactSafetyNote}</Text>
              </View>
              {isPhone && (
                <TouchableOpacity style={s.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
                  <MessageCircle size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={{ color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: '800' }}>{t.contactOnWhatsApp}</Text>
                </TouchableOpacity>
              )}
              {isPhone && (
                <TouchableOpacity style={[s.callBtn, { borderColor: C.neonBlueBorder }]} onPress={handleCall} activeOpacity={0.8}>
                  <Phone size={18} color={C.neonBlue} strokeWidth={2} />
                  <Text style={{ color: C.neonBlue, fontSize: FontSize.md, fontWeight: '700' }}>{t.callSeller}</Text>
                </TouchableOpacity>
              )}
              {!isPhone && (
                <TouchableOpacity
                  style={s.whatsappBtn}
                  onPress={() => Linking.openURL(`tel:${contactRaw}`).catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Phone size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={{ color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: '800' }}>{t.contactSeller}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!isOwner && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, opacity: 0.6 }}
                onPress={() => openReport('listing')}
                activeOpacity={0.75}
              >
                <Flag size={13} color={C.textMuted} strokeWidth={2} />
                <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }}>Report listing</Text>
              </TouchableOpacity>
              {listing.user_id && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, opacity: 0.6 }}
                  onPress={() => openReport('seller')}
                  activeOpacity={0.75}
                >
                  <Flag size={13} color={C.textMuted} strokeWidth={2} />
                  <Text style={{ color: C.textMuted, fontSize: FontSize.xs, fontWeight: '600' }}>Report seller</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Report Modal ── */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
            <View style={s.modalHeader}>
              <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '800' }}>
                {reportTarget === 'seller' ? 'Report Seller' : 'Report Listing'}
              </Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={C.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {reportDone ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md }}>
                <CircleCheck size={48} color={C.success} strokeWidth={1.5} />
                <Text style={{ color: C.success, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center' }}>Report Submitted</Text>
                <Text style={{ color: C.textSecondary, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 }}>
                  Thank you. Our team will review this report shortly.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {!user && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.warning + '14', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '40', padding: Spacing.sm, marginBottom: Spacing.md }}>
                    <AlertTriangle size={14} color={C.warning} strokeWidth={2} />
                    <Text style={{ flex: 1, color: C.warning, fontSize: FontSize.xs, fontWeight: '600' }}>You must be signed in to submit a report.</Text>
                  </View>
                )}

                <Text style={[s.modalLabel, { color: C.textMuted }]}>Reason *</Text>
                <View style={{ gap: 8, marginBottom: Spacing.md }}>
                  {REPORT_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.backgroundSecondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                        reportReason === r.value && { borderColor: C.error, backgroundColor: C.errorDim },
                      ]}
                      onPress={() => { setReportReason(r.value); setReportError(''); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[{ color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '600' }, reportReason === r.value && { color: C.error, fontWeight: '700' }]}>{r.label}</Text>
                      {reportReason === r.value && <CircleCheck size={16} color={C.error} strokeWidth={2} />}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.modalLabel, { color: C.textMuted }]}>Additional note (optional)</Text>
                <TextInput
                  style={[s.modalTextArea, { backgroundColor: C.backgroundInput, borderColor: C.border, color: C.textPrimary }]}
                  value={reportNote}
                  onChangeText={setReportNote}
                  placeholder="Describe the issue..."
                  placeholderTextColor={C.textMuted}
                  multiline
                  numberOfLines={3}
                />

                {reportError !== '' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
                    <AlertTriangle size={13} color={C.error} strokeWidth={2} />
                    <Text style={{ color: C.error, fontSize: FontSize.xs, fontWeight: '600', flex: 1 }}>{reportError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: C.error }, (reportSubmitting || !user) && { opacity: 0.5 }]}
                  onPress={handleSubmitReport}
                  activeOpacity={0.8}
                  disabled={reportSubmitting || !user}
                >
                  {reportSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '800' }}>Submit Report</Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: Spacing.md }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Boost Modal ── */}
      <Modal
        visible={showBoostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBoostModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
            <View style={s.modalHeader}>
              <Text style={{ color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '800' }}>Boost Your Listing</Text>
              <TouchableOpacity onPress={() => setShowBoostModal(false)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={C.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {boostDone ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md }}>
                <CircleCheck size={48} color={C.success} strokeWidth={1.5} />
                <Text style={{ color: C.textSecondary, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 }}>Boost request sent! Admin will activate it after payment confirmation.</Text>
              </View>
            ) : (
              <View style={{ gap: Spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.gold + '14', borderRadius: Radius.md, borderWidth: 1, borderColor: C.gold + '4D', padding: Spacing.md }}>
                  <Zap size={28} color={C.gold} strokeWidth={2} fill={C.gold} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: C.gold, fontSize: FontSize.md, fontWeight: '800' }}>Featured placement</Text>
                    <Text style={{ color: C.textMuted, fontSize: FontSize.xs, lineHeight: 16 }}>
                      Your listing appears at the top of the marketplace for {boostSettings.durationDays} days.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
                  <Text style={{ color: C.textMuted, fontSize: FontSize.sm }}>Boost price</Text>
                  <Text style={{ color: C.textPrimary, fontSize: FontSize.xl, fontWeight: '900' }}>${boostSettings.price.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
                  <Text style={{ color: C.textMuted, fontSize: FontSize.sm }}>Duration</Text>
                  <Text style={{ color: C.textPrimary, fontSize: FontSize.sm, fontWeight: '700' }}>{boostSettings.durationDays} days</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.warning + '12', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '33', padding: Spacing.sm }}>
                  <AlertTriangle size={13} color={C.warning} strokeWidth={2} />
                  <Text style={{ flex: 1, color: C.warning, fontSize: FontSize.xs, fontWeight: '500', lineHeight: 16 }}>
                    Payment will be arranged by admin after you submit this request. Your listing will be boosted once payment is confirmed.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: C.neonBlue }, boostSubmitting && { opacity: 0.5 }]}
                  onPress={handleRequestBoost}
                  activeOpacity={0.8}
                  disabled={boostSubmitting}
                >
                  {boostSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '800' }}>Request Boost — ${boostSettings.price.toFixed(2)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Image Lightbox ── */}
      <Modal
        visible={showLightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLightbox(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Image
            source={{ uri: images[imgIdx] }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
          {images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <TouchableOpacity
                  style={[s.lbNavBtn, { left: 12 }]}
                  onPress={() => setImgIdx((i) => i - 1)}
                  activeOpacity={0.8}
                >
                  <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
              {imgIdx < images.length - 1 && (
                <TouchableOpacity
                  style={[s.lbNavBtn, { right: 12 }]}
                  onPress={() => setImgIdx((i) => i + 1)}
                  activeOpacity={0.8}
                >
                  <ChevronRight size={28} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
              <View style={{ position: 'absolute', bottom: 32, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 5 }}>
                <Text style={{ color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '700' }}>{imgIdx + 1} / {images.length}</Text>
              </View>
            </>
          )}
          <TouchableOpacity
            style={[s.lbCloseBtn, { top: insets.top + 12 }]}
            onPress={() => setShowLightbox(false)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function BoostCTA({
  boostStatus,
  boostSettings,
  boosted,
  onPress,
  C,
}: {
  boostStatus: string | null;
  boostSettings: BoostSettings;
  boosted: boolean;
  onPress: () => void;
  C: any;
}) {
  if (boosted) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.gold + '1A', borderRadius: Radius.md, borderWidth: 1, borderColor: C.gold + '66', padding: Spacing.md }}>
        <Zap size={16} color={C.gold} strokeWidth={2.5} fill={C.gold} />
        <Text style={{ color: C.gold, fontSize: FontSize.sm, fontWeight: '700' }}>Listing is currently featured</Text>
      </View>
    );
  }
  if (boostStatus === 'pending_payment') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.warning + '14', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '4D', padding: Spacing.md }}>
        <Zap size={16} color={C.warning} strokeWidth={2} />
        <Text style={{ color: C.warning, fontSize: FontSize.sm, fontWeight: '600' }}>Boost pending payment confirmation</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.gold + '14', borderRadius: Radius.md, borderWidth: 1, borderColor: C.gold + '59', padding: Spacing.md }} onPress={onPress} activeOpacity={0.85}>
      <Zap size={16} color={C.gold} strokeWidth={2.5} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.gold, fontSize: FontSize.sm, fontWeight: '800' }}>Boost this listing</Text>
        <Text style={{ color: C.gold + '99', fontSize: FontSize.xs, fontWeight: '500', marginTop: 2 }}>
          Featured placement for {boostSettings.durationDays} days · ${boostSettings.price.toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function hasAnyRigField(listing: UsedGearListing, prefix: 'main' | 'reserve' | 'aad'): boolean {
  const keys = Object.keys(listing) as (keyof UsedGearListing)[];
  return keys.some((k) => k.startsWith(prefix + '_') && !!listing[k]);
}

function DetailCard({ title, children, C }: { title: string; children: React.ReactNode; C: any }) {
  const rows = React.Children.toArray(children).filter((c) => {
    const el = c as React.ReactElement<{ value?: string }>;
    return el.props?.value;
  });
  if (rows.length === 0) return null;
  return (
    <View style={{ backgroundColor: C.backgroundCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
      <Text style={{ color: C.textSecondary, fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: C.neonBlueGlow, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {title}
      </Text>
      <View style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>{rows}</View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  C,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
  C: any;
}) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
      <Text style={{ color: C.textMuted, fontSize: FontSize.sm, fontWeight: '600', flex: 1 }}>{label}</Text>
      <Text style={{ color: highlight ? C.warning : C.textPrimary, fontSize: FontSize.sm, fontWeight: '700', flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function StarRow({ value, size = 14, interactive = false, C }: { value: number; size?: number; interactive?: boolean; C: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          color={s <= Math.round(value) ? C.gold : C.textMuted}
          fill={s <= Math.round(value) ? C.gold : 'transparent'}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 30,
  },
  topBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5,10,20,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  boostBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 60,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.4)',
  },
  imgNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgNavLeft: { left: 12 },
  imgNavRight: { right: 12 },
  imgDots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  condBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 68,
    right: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  condBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  viewCountChip: {
    position: 'absolute',
    bottom: 14,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5,10,20,0.65)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#25D366',
    borderRadius: Radius.full,
    paddingVertical: 16,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'transparent',
    borderRadius: Radius.full,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: Spacing.sm,
  },
  modalTextArea: {
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  modalInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: 4,
  },
  submitBtn: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  lbNavBtn: {
    position: 'absolute',
    top: '50%' as any,
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lbCloseBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
