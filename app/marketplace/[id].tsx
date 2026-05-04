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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
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
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useGearWishlist } from '@/context/GearWishlistContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
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
  'Fake / scam listing',
  'Incorrect / misleading info',
  'Wrong price',
  'Item already sold',
  'Dangerous / unsafe gear',
  'Other',
];

function isBoosted(listing: UsedGearListing): boolean {
  return (
    listing.boost_status === 'boosted' &&
    !!listing.boost_expires_at &&
    new Date(listing.boost_expires_at).getTime() > Date.now()
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isGearWishlisted, toggleGear } = useGearWishlist();

  const [listing, setListing] = useState<UsedGearListing | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [myRating, setMyRating] = useState<number>(0);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [ratingMsg, setRatingMsg] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [reportPhone, setReportPhone] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState('');

  // Boost state
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostSettings, setBoostSettings] = useState<BoostSettings>({ price: 9.99, durationDays: 7 });
  const [boostSubmitting, setBoostSubmitting] = useState(false);
  const [boostDone, setBoostDone] = useState(false);
  const [existingBoostStatus, setExistingBoostStatus] = useState<string | null>(null);

  // View tracking — once per session
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  const loadAll = async () => {
    const [{ data: listingData }, { data: ratingData }] = await Promise.all([
      supabase.from('used_gear_listings').select('*').eq('id', id).maybeSingle(),
      user
        ? supabase
            .from('seller_ratings')
            .select('stars')
            .eq('listing_id', id)
            .eq('rater_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const l = listingData as UsedGearListing | null;
    setListing(l);
    if (l?.boost_status) setExistingBoostStatus(l.boost_status);

    if (ratingData) {
      setExistingRating((ratingData as any).stars);
      setMyRating((ratingData as any).stars);
    }

    if (l?.user_id) {
      const { data: sellerData } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', l.user_id)
        .maybeSingle();
      setSeller(sellerData as SellerProfile | null);
    }

    setLoading(false);
  };

  // Track view after listing loaded
  useEffect(() => {
    if (!listing || viewTracked.current) return;
    viewTracked.current = true;

    const viewerKey = user?.id
      ? `user_${user.id}`
      : `anon_${Platform.OS}_${Date.now().toString(36).slice(-6)}`;

    supabase.from('listing_views').insert({
      listing_id: listing.id,
      viewer_key: viewerKey,
    }).then(() => {});
  }, [listing]);

  // Load boost settings from site_settings
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['boost_price_usd', 'boost_duration_days'])
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const r of data as { key: string; value: string }[]) map[r.key] = r.value;
        setBoostSettings({
          price: parseFloat(map['boost_price_usd'] ?? '9.99'),
          durationDays: parseInt(map['boost_duration_days'] ?? '7', 10),
        });
      });
  }, []);

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
          .select('*')
          .eq('user_id', listing.user_id)
          .maybeSingle();
        setSeller(data as SellerProfile | null);
      }
    }
    setTimeout(() => setRatingMsg(''), 3000);
  };

  const handleSubmitReport = async () => {
    if (!reportReason) { setReportError('Please select a reason.'); return; }
    setReportSubmitting(true);
    setReportError('');
    const { error } = await supabase.from('listing_reports').insert({
      listing_id: listing!.id,
      reporter_id: user?.id ?? null,
      reporter_email: user?.email ?? null,
      reason: reportReason,
      message: reportMessage.trim() || null,
      reporter_phone: reportPhone.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      setReportError('Failed to submit report. Please try again.');
    } else {
      setReportDone(true);
      setTimeout(() => setShowReportModal(false), 2000);
    }
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
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Listing not found</Text>
      </View>
    );
  }

  const rawImages = listing.images ?? [];
  const images = listing.main_image_url && !rawImages.includes(listing.main_image_url)
    ? [listing.main_image_url, ...rawImages]
    : rawImages.length > 0 ? rawImages : listing.main_image_url ? [listing.main_image_url] : [];
  const condColor = CONDITION_COLORS[listing.condition] ?? Colors.textMuted;
  const isVerified = listing.seller_verified || seller?.is_verified;
  const isRig = RIG_CATEGORIES.includes(listing.category);
  const boosted = isBoosted(listing);
  const isOwner = user?.id === listing.user_id;
  const views = listing.view_count ?? 0;

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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {!isOwner && (
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => toggleGear(listing)}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Heart
            size={20}
            color={wishlisted ? Colors.error : '#FFFFFF'}
            fill={wishlisted ? Colors.error : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Image carousel */}
        <View style={styles.imageWrap}>
          {/* Boosted banner */}
          {boosted && (
            <View style={styles.boostBanner}>
              <Zap size={12} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
              <Text style={styles.boostBannerText}>FEATURED LISTING</Text>
            </View>
          )}

          {images.length > 0 ? (
            <>
              <Image
                source={{ uri: images[imgIdx] }}
                style={StyleSheet.absoluteFillObject as any}
                resizeMode="cover"
              />
              {images.length > 1 && (
                <>
                  {imgIdx > 0 && (
                    <TouchableOpacity
                      style={[styles.imgNav, styles.imgNavLeft]}
                      onPress={() => setImgIdx((i) => i - 1)}
                      activeOpacity={0.8}
                    >
                      <ChevronLeft size={22} color={Colors.white} strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                  {imgIdx < images.length - 1 && (
                    <TouchableOpacity
                      style={[styles.imgNav, styles.imgNavRight]}
                      onPress={() => setImgIdx((i) => i + 1)}
                      activeOpacity={0.8}
                    >
                      <ChevronRight size={22} color={Colors.white} strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                  <View style={styles.imgDots}>
                    {images.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setImgIdx(i)} activeOpacity={0.8}>
                        <View style={[styles.dot, i === imgIdx && styles.dotActive]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <View style={styles.imgPlaceholder}>
              <Tag size={48} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
          )}
          <View style={[styles.condBadge, { borderColor: condColor }]}>
            <Text style={[styles.condBadgeText, { color: condColor }]}>
              {conditionLabel(listing.condition, t)}
            </Text>
          </View>

          {/* View count */}
          {views > 0 && (
            <View style={styles.viewCountChip}>
              <Eye size={12} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              <Text style={styles.viewCountText}>{views} views</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {/* Title + price */}
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>${Number(listing.price).toLocaleString()}</Text>
            {listing.shipping_included && (
              <View style={styles.shippingBadge}>
                <Truck size={12} color={Colors.success} strokeWidth={2} />
                <Text style={styles.shippingBadgeText}>Shipping included</Text>
              </View>
            )}
          </View>

          {listing.category ? (
            <Text style={styles.category}>{listing.category.replace(/_/g, ' ').toUpperCase()}</Text>
          ) : null}

          {/* Location */}
          {!!listing.location && (
            <View style={styles.locationRow}>
              <MapPin size={13} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.locationText}>{listing.location}</Text>
            </View>
          )}

          {/* Safety warning */}
          <View style={styles.safetyBox}>
            <AlertTriangle size={14} color={Colors.warning} strokeWidth={2} />
            <Text style={styles.safetyText}>{t.usedGearSafetyWarning}</Text>
          </View>

          {/* ── Owner: Boost CTA ── */}
          {isOwner && listing.status === 'approved' && (
            <BoostCTA
              boostStatus={existingBoostStatus}
              boostSettings={boostSettings}
              boosted={boosted}
              onPress={() => { setBoostDone(false); setShowBoostModal(true); }}
            />
          )}

          {/* ── Gear Specs ── */}
          <DetailCard title="Equipment Details">
            <DetailRow label="Make" value={listing.make} />
            <DetailRow label="Model" value={listing.model} />
            <DetailRow label="Size" value={listing.size} />
            <DetailRow label="Color" value={listing.color} />
            <DetailRow label="DOM" value={listing.dom} />
            <DetailRow label="Serial Number" value={listing.serial_number} />
            <DetailRow label="Total Jumps" value={listing.total_jumps != null ? String(listing.total_jumps) : ''} />
          </DetailCard>

          {/* ── Rig Sub-Components ── */}
          {isRig && (
            <>
              {hasAnyRigField(listing, 'main') && (
                <DetailCard title="Main Canopy">
                  <DetailRow label="Make" value={listing.main_make} />
                  <DetailRow label="Model" value={listing.main_model} />
                  <DetailRow label="Size" value={listing.main_size} />
                  <DetailRow label="DOM" value={listing.main_dom} />
                  <DetailRow label="Jumps" value={listing.main_jumps != null ? String(listing.main_jumps) : ''} />
                  <DetailRow label="Serial" value={listing.main_serial} />
                </DetailCard>
              )}

              {hasAnyRigField(listing, 'reserve') && (
                <DetailCard title="Reserve">
                  <DetailRow label="Make" value={listing.reserve_make} />
                  <DetailRow label="Model" value={listing.reserve_model} />
                  <DetailRow label="Size" value={listing.reserve_size} />
                  <DetailRow label="DOM" value={listing.reserve_dom} />
                  <DetailRow label="Repacks" value={listing.reserve_repacks != null ? String(listing.reserve_repacks) : ''} />
                  <DetailRow label="Serial" value={listing.reserve_serial} />
                </DetailCard>
              )}

              {hasAnyRigField(listing, 'aad') && (
                <DetailCard title="AAD">
                  <DetailRow label="Make" value={listing.aad_make} />
                  <DetailRow label="Model" value={listing.aad_model} />
                  <DetailRow label="DOM" value={listing.aad_dom} />
                  <DetailRow label="EOL" value={listing.aad_eol} />
                  <DetailRow label="Jumps" value={listing.aad_jumps != null ? String(listing.aad_jumps) : ''} />
                  <DetailRow label="Needs Service" value={listing.aad_needs_service ? 'Yes' : ''} highlight={listing.aad_needs_service} />
                  <DetailRow label="Serial" value={listing.aad_serial} />
                </DetailCard>
              )}
            </>
          )}

          {/* ── Seller Info ── */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerCardHeader}>
              <Text style={styles.sellerCardTitle}>{t.sellerInfo}</Text>
              {isVerified && (
                <View style={styles.verifiedBadge}>
                  <BadgeCheck size={13} color={Colors.neonBlue} strokeWidth={2.5} />
                  <Text style={styles.verifiedText}>{t.verifiedSeller}</Text>
                </View>
              )}
            </View>
            <View style={styles.sellerStats}>
              {seller && (
                <>
                  <View style={styles.statItem}>
                    <Package size={14} color={Colors.textMuted} strokeWidth={2} />
                    <Text style={styles.statLabel}>{t.totalListings}</Text>
                    <Text style={styles.statValue}>{seller.total_listings}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Calendar size={14} color={Colors.textMuted} strokeWidth={2} />
                    <Text style={styles.statLabel}>{t.memberSince}</Text>
                    <Text style={styles.statValue}>
                      {new Date(seller.join_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                </>
              )}
            </View>
            {seller && seller.rating_count > 0 ? (
              <View style={styles.avgRatingRow}>
                <StarRow value={seller.avg_rating} size={16} />
                <Text style={styles.avgRatingText}>
                  {Number(seller.avg_rating).toFixed(1)} · {seller.rating_count} {t.ratingStars}
                </Text>
              </View>
            ) : (
              <Text style={styles.noRatingsText}>{t.noRatingsYet}</Text>
            )}
          </View>

          {/* ── Rate seller ── */}
          <View style={styles.rateSection}>
            <Text style={styles.rateSectionTitle}>{t.rateThisSeller}</Text>
            {existingRating !== null ? (
              <View style={styles.alreadyRatedRow}>
                <StarRow value={existingRating} size={22} interactive={false} />
                <Text style={styles.alreadyRatedText}>{t.alreadyRated}</Text>
              </View>
            ) : (
              <View style={styles.starRow}>
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
                      color={s <= myRating ? Colors.gold : Colors.textMuted}
                      fill={s <= myRating ? Colors.gold : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                ))}
                {submittingRating && (
                  <ActivityIndicator size="small" color={Colors.neonBlue} style={{ marginLeft: 8 }} />
                )}
              </View>
            )}
            {ratingMsg !== '' && <Text style={styles.ratingMsg}>{ratingMsg}</Text>}
          </View>

          {/* Description */}
          {!!listing.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.listingDescription}</Text>
              <Text style={styles.descText}>{listing.description}</Text>
            </View>
          )}

          <Text style={styles.postedDate}>
            {t.postedOn}{' '}
            {new Date(listing.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          {/* Contact */}
          {!!listing.contact && (
            <View style={styles.contactSection}>
              <View style={styles.contactSafetyRow}>
                <ShieldCheck size={13} color={Colors.success} strokeWidth={2} />
                <Text style={styles.contactSafetyText}>{t.contactSafetyNote}</Text>
              </View>
              {isPhone && (
                <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
                  <MessageCircle size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.whatsappBtnText}>{t.contactOnWhatsApp}</Text>
                </TouchableOpacity>
              )}
              {isPhone && (
                <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.8}>
                  <Phone size={18} color={Colors.neonBlue} strokeWidth={2} />
                  <Text style={styles.callBtnText}>{t.callSeller}</Text>
                </TouchableOpacity>
              )}
              {!isPhone && (
                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={() => Linking.openURL(`tel:${contactRaw}`).catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Phone size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.whatsappBtnText}>{t.contactSeller}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Report listing */}
          {!isOwner && (
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => { setReportDone(false); setReportError(''); setReportReason(''); setReportMessage(''); setReportPhone(''); setShowReportModal(true); }}
              activeOpacity={0.75}
            >
              <Flag size={14} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.reportBtnText}>Report this listing</Text>
            </TouchableOpacity>
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
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Report Listing</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {reportDone ? (
              <View style={modalStyles.doneWrap}>
                <CircleCheck size={48} color={Colors.success} strokeWidth={1.5} />
                <Text style={modalStyles.doneText}>Report submitted. Thank you.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={modalStyles.label}>Reason *</Text>
                <View style={modalStyles.reasonGrid}>
                  {REPORT_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[modalStyles.reasonChip, reportReason === r && modalStyles.reasonChipActive]}
                      onPress={() => { setReportReason(r); setReportError(''); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[modalStyles.reasonChipText, reportReason === r && modalStyles.reasonChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={modalStyles.label}>Additional details</Text>
                <TextInput
                  style={modalStyles.textArea}
                  value={reportMessage}
                  onChangeText={setReportMessage}
                  placeholder="Describe the issue..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                <Text style={modalStyles.label}>Your WhatsApp / phone (optional)</Text>
                <TextInput
                  style={modalStyles.input}
                  value={reportPhone}
                  onChangeText={setReportPhone}
                  placeholder="+1 555 000 0000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
                <Text style={modalStyles.hint}>Admin may contact you to follow up.</Text>

                {reportError !== '' && <Text style={modalStyles.errorText}>{reportError}</Text>}

                <TouchableOpacity
                  style={[modalStyles.submitBtn, reportSubmitting && modalStyles.submitBtnDisabled]}
                  onPress={handleSubmitReport}
                  activeOpacity={0.8}
                  disabled={reportSubmitting}
                >
                  {reportSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={modalStyles.submitBtnText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
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
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Boost Your Listing</Text>
              <TouchableOpacity onPress={() => setShowBoostModal(false)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {boostDone ? (
              <View style={modalStyles.doneWrap}>
                <CircleCheck size={48} color={Colors.success} strokeWidth={1.5} />
                <Text style={modalStyles.doneText}>Boost request sent! Admin will activate it after payment confirmation.</Text>
              </View>
            ) : (
              <View style={modalStyles.boostBody}>
                <View style={modalStyles.boostHighlight}>
                  <Zap size={28} color="#FFD700" strokeWidth={2} fill="#FFD700" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={modalStyles.boostHighlightTitle}>Featured placement</Text>
                    <Text style={modalStyles.boostHighlightDesc}>
                      Your listing appears at the top of the marketplace for {boostSettings.durationDays} days.
                    </Text>
                  </View>
                </View>

                <View style={modalStyles.boostPriceRow}>
                  <Text style={modalStyles.boostPriceLabel}>Boost price</Text>
                  <Text style={modalStyles.boostPrice}>${boostSettings.price.toFixed(2)}</Text>
                </View>
                <View style={modalStyles.boostPriceRow}>
                  <Text style={modalStyles.boostPriceLabel}>Duration</Text>
                  <Text style={modalStyles.boostPriceMeta}>{boostSettings.durationDays} days</Text>
                </View>

                <View style={modalStyles.boostPaymentNote}>
                  <AlertTriangle size={13} color={Colors.warning} strokeWidth={2} />
                  <Text style={modalStyles.boostPaymentNoteText}>
                    Payment will be arranged by admin after you submit this request. Your listing will be boosted once payment is confirmed.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[modalStyles.submitBtn, boostSubmitting && modalStyles.submitBtnDisabled]}
                  onPress={handleRequestBoost}
                  activeOpacity={0.8}
                  disabled={boostSubmitting}
                >
                  {boostSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={modalStyles.submitBtnText}>Request Boost — ${boostSettings.price.toFixed(2)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
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
}: {
  boostStatus: string | null;
  boostSettings: BoostSettings;
  boosted: boolean;
  onPress: () => void;
}) {
  if (boosted) {
    return (
      <View style={boostCtaStyles.active}>
        <Zap size={16} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
        <Text style={boostCtaStyles.activeText}>Listing is currently featured</Text>
      </View>
    );
  }
  if (boostStatus === 'pending_payment') {
    return (
      <View style={boostCtaStyles.pending}>
        <Zap size={16} color={Colors.warning} strokeWidth={2} />
        <Text style={boostCtaStyles.pendingText}>Boost pending payment confirmation</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={boostCtaStyles.btn} onPress={onPress} activeOpacity={0.85}>
      <Zap size={16} color="#FFD700" strokeWidth={2.5} />
      <View style={{ flex: 1 }}>
        <Text style={boostCtaStyles.btnTitle}>Boost this listing</Text>
        <Text style={boostCtaStyles.btnSub}>
          Featured placement for {boostSettings.durationDays} days · ${boostSettings.price.toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const boostCtaStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    padding: Spacing.md,
  },
  btnTitle: {
    color: '#FFD700',
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  btnSub: {
    color: 'rgba(255,215,0,0.6)',
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    padding: Spacing.md,
  },
  activeText: {
    color: '#FFD700',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.3)',
    padding: Spacing.md,
  },
  pendingText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: Spacing.sm,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  reasonChipActive: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  reasonChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: Colors.error,
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: 4,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  submitBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  doneWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  doneText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  boostBody: {
    gap: Spacing.md,
  },
  boostHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    padding: Spacing.md,
  },
  boostHighlightTitle: {
    color: '#FFD700',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  boostHighlightDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  boostPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  boostPriceLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  boostPrice: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  boostPriceMeta: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  boostPaymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,179,0,0.07)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.2)',
    padding: Spacing.sm,
  },
  boostPaymentNoteText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },
});

function hasAnyRigField(listing: UsedGearListing, prefix: 'main' | 'reserve' | 'aad'): boolean {
  const keys = Object.keys(listing) as (keyof UsedGearListing)[];
  return keys.some((k) => k.startsWith(prefix + '_') && !!listing[k]);
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter((c) => {
    const el = c as React.ReactElement<{ value?: string }>;
    return el.props?.value;
  });
  if (rows.length === 0) return null;
  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.title}>{title}</Text>
      <View style={cardStyles.body}>{rows}</View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  title: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,191,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,191,255,0.07)',
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    flex: 2,
    textAlign: 'right',
  },
  valueHighlight: {
    color: Colors.warning,
  },
});

function StarRow({ value, size = 14, interactive = false }: { value: number; size?: number; interactive?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          color={s <= Math.round(value) ? Colors.gold : Colors.textMuted}
          fill={s <= Math.round(value) ? Colors.gold : 'transparent'}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    left: Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,191,255,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  heartBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    right: Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 8,
  },
  imageWrap: {
    width: '100%',
    height: Platform.OS === 'web' ? 420 : 320,
    backgroundColor: Colors.backgroundSecondary,
    position: 'relative',
  },
  boostBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.18)',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.35)',
  },
  boostBannerText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  imgPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.7)',
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
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: Colors.neonBlue,
    width: 18,
    borderRadius: 3.5,
  },
  condBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 36,
    right: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(5,10,20,0.8)',
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
  viewCountText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  price: {
    color: Colors.neonBlue,
    fontSize: FontSize.xxl,
    fontWeight: '900',
  },
  shippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shippingBadgeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  category: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.25)',
    padding: Spacing.sm,
  },
  safetyText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 17,
  },
  sellerCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sellerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerCardTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sellerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
  },
  avgRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avgRatingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  noRatingsText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  rateSection: {
    gap: Spacing.sm,
  },
  rateSectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  alreadyRatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  alreadyRatedText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  ratingMsg: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  descText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  postedDate: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  contactSection: {
    gap: Spacing.sm,
  },
  contactSafetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  contactSafetyText: {
    flex: 1,
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
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
  whatsappBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: '800',
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
    borderColor: Colors.neonBlueBorder,
  },
  callBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    opacity: 0.6,
  },
  reportBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
