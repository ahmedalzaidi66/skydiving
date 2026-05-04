import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import {
  Search, X, Check, CircleX, Trash2, ChevronRight, Tag, BadgeCheck, Star,
  Flag, Zap, Settings, MessageSquare, EyeOff, CheckCheck,
} from 'lucide-react-native';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { conditionLabel, CONDITION_COLORS, UsedGearListing } from '@/app/(tabs)/marketplace';

type SellerProfile = {
  user_id: string;
  is_verified: boolean;
  avg_rating: number;
  rating_count: number;
  total_listings: number;
  join_date: string;
};

type ListingReport = {
  id: string;
  listing_id: string;
  reporter_id: string | null;
  reporter_email: string;
  reason: string;
  message: string;
  reporter_phone: string;
  status: string;
  admin_note: string;
  created_at: string;
  listing_title?: string;
};

type ListingBoost = {
  id: string;
  listing_id: string;
  user_id: string;
  status: string;
  price_paid: number | null;
  duration_days: number;
  boosted_at: string | null;
  expires_at: string | null;
  admin_note: string | null;
  is_reboost: boolean;
  created_at: string;
  listing_title?: string;
  listing_user_email?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  approved: Colors.success,
  rejected: Colors.error,
  sold: Colors.textMuted,
};

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'sold'] as const;

const ADMIN_TABS = ['listings', 'reports', 'boosts', 'settings'] as const;
type AdminTab = typeof ADMIN_TABS[number];

function MarketplaceContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('listings');

  // Listings state
  const [listings, setListings] = useState<UsedGearListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('pending');
  const [selected, setSelected] = useState<UsedGearListing | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReasonError, setRejectReasonError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Reports state
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'dismissed'>('pending');

  // Boosts state
  const [boosts, setBoosts] = useState<ListingBoost[]>([]);
  const [loadingBoosts, setLoadingBoosts] = useState(false);
  const [boostStatusFilter, setBoostStatusFilter] = useState<'all' | 'pending_approval' | 'active' | 'expired' | 'rejected'>('pending_approval');
  const [boostRejectTarget, setBoostRejectTarget] = useState<ListingBoost | null>(null);
  const [boostRejectReason, setBoostRejectReason] = useState('');
  const [boostRejectError, setBoostRejectError] = useState('');

  // Boost settings state
  const [boostPrice, setBoostPrice] = useState('9.99');
  const [boostDuration, setBoostDuration] = useState('7');
  const [reboostDiscountPct, setReboostDiscountPct] = useState('50');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    if (activeTab === 'reports' && reports.length === 0) fetchReports();
    if (activeTab === 'boosts' && boosts.length === 0) fetchBoosts();
    if (activeTab === 'settings') fetchBoostSettings();
  }, [activeTab]);

  const fetchListings = async () => {
    const { data } = await adminSupabase()
      .from('used_gear_listings')
      .select('*')
      .order('created_at', { ascending: false });
    setListings((data ?? []) as UsedGearListing[]);
    setLoadingListings(false);
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    const { data } = await adminSupabase()
      .from('listing_reports')
      .select('*, used_gear_listings(title)')
      .order('created_at', { ascending: false });
    const mapped: ListingReport[] = (data ?? []).map((r: any) => ({
      ...r,
      listing_title: r.used_gear_listings?.title ?? r.listing_id,
    }));
    setReports(mapped);
    setLoadingReports(false);
  };

  const fetchBoosts = async () => {
    setLoadingBoosts(true);
    const { data } = await adminSupabase()
      .from('listing_boosts')
      .select('*, used_gear_listings(title, user_email)')
      .order('created_at', { ascending: false });
    const mapped: ListingBoost[] = (data ?? []).map((b: any) => ({
      ...b,
      listing_title: b.used_gear_listings?.title ?? b.listing_id,
      listing_user_email: b.used_gear_listings?.user_email ?? '',
    }));
    setBoosts(mapped);
    setLoadingBoosts(false);
  };

  const fetchBoostSettings = async () => {
    const { data } = await adminSupabase()
      .from('site_settings')
      .select('key, value')
      .in('key', ['boost_price_usd', 'boost_duration_days', 'reboost_discount_pct']);
    if (data) {
      data.forEach((row: { key: string; value: string }) => {
        if (row.key === 'boost_price_usd') setBoostPrice(row.value);
        if (row.key === 'boost_duration_days') setBoostDuration(row.value);
        if (row.key === 'reboost_discount_pct') setReboostDiscountPct(row.value);
      });
    }
  };

  const fetchSellerProfile = async (userId: string) => {
    const { data } = await supabase
      .from('seller_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setSellerProfile(data as SellerProfile | null);
  };

  const toggleVerified = async () => {
    if (!selected) return;
    setSaving(true);
    const newVerified = !(sellerProfile?.is_verified ?? false);
    const { error } = await adminSupabase().rpc('admin_verify_listing_seller', {
      p_listing_id: selected.id,
      p_verified: newVerified,
    });
    setSaving(false);
    if (error) {
      console.error('[toggleVerified] RPC error', { message: error.message, code: (error as any).code, details: (error as any).details });
      showFeedback(`Error: ${error.message}`);
      return;
    }
    await fetchSellerProfile(selected.user_id);
    await fetchListings();
    setSelected((prev) => prev ? { ...prev, seller_verified: newVerified } : prev);
    showFeedback(t.verifiedUpdated);
  };

  const openListing = (item: UsedGearListing) => {
    setSelected(item);
    setAdminNote(item.admin_note ?? '');
    setRejectReason('');
    setRejectReasonError('');
    setShowRejectModal(false);
    setSuccessMsg('');
    setSellerProfile(null);
    fetchSellerProfile(item.user_id);
  };

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const updateStatus = async (id: string, status: string, noteOverride?: string) => {
    if (saving) return;
    setSaving(true);
    const note = noteOverride !== undefined ? noteOverride : adminNote;
    try {
      const { data, error } = await adminSupabase().rpc('admin_update_listing_status', {
        p_listing_id: id,
        p_status: status,
        p_admin_note: note || null,
      });
      if (error) {
        console.error('[updateStatus] RPC error', { message: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint });
        throw new Error(error.message);
      }
      if (data && data.ok === false) {
        console.error('[updateStatus] RPC returned not-ok', data);
        throw new Error(data.error ?? 'Update failed');
      }
      setSelected((prev) => prev ? { ...prev, status, admin_note: note } : prev);
      await fetchListings();
      showFeedback(t.listingUpdated);
    } catch (e: any) {
      showFeedback(`Error: ${e?.message ?? 'Update failed'}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteListing = async (id: string) => {
    const doDelete = async () => {
      setSaving(true);
      await adminSupabase().from('used_gear_listings').delete().eq('id', id);
      setSaving(false);
      await fetchListings();
      setSelected(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t.confirmDeleteListing)) doDelete();
    } else {
      Alert.alert(t.deleteListing, t.confirmDeleteListing, [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Reports actions
  const dismissReport = async (reportId: string) => {
    await adminSupabase()
      .from('listing_reports')
      .update({ status: 'dismissed' })
      .eq('id', reportId);
    await fetchReports();
  };

  const hideListingFromReport = async (reportId: string, listingId: string) => {
    await adminSupabase()
      .from('listing_reports')
      .update({ status: 'actioned' })
      .eq('id', reportId);
    await adminSupabase()
      .from('used_gear_listings')
      .update({ status: 'rejected', admin_note: 'Hidden due to user reports.' })
      .eq('id', listingId);
    await fetchReports();
    await fetchListings();
  };

  const openWhatsApp = (phone: string, listingTitle: string) => {
    const clean = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hi, I'm contacting you regarding your report about the listing "${listingTitle}" on our marketplace.`);
    const url = `https://wa.me/${clean}?text=${msg}`;
    Linking.openURL(url).catch(() => {});
  };

  // Boosts actions
  const approveBoost = async (boost: ListingBoost) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + boost.duration_days * 86400000).toISOString();
    setSaving(true);
    await adminSupabase()
      .from('listing_boosts')
      .update({ status: 'active', boosted_at: now.toISOString(), expires_at: expiresAt })
      .eq('id', boost.id);
    await adminSupabase()
      .from('used_gear_listings')
      .update({ boost_status: 'boosted', boost_expires_at: expiresAt })
      .eq('id', boost.listing_id);
    setSaving(false);
    await fetchBoosts();
    showFeedback('Boost approved and activated.');
  };

  const rejectBoost = async (boost: ListingBoost, reason: string) => {
    setSaving(true);
    await adminSupabase()
      .from('listing_boosts')
      .update({ status: 'rejected', admin_note: reason || null })
      .eq('id', boost.id);
    setSaving(false);
    setBoostRejectTarget(null);
    setBoostRejectReason('');
    setBoostRejectError('');
    await fetchBoosts();
    showFeedback('Boost rejected.');
  };

  const expireBoost = async (boost: ListingBoost) => {
    setSaving(true);
    await adminSupabase()
      .from('listing_boosts')
      .update({ status: 'expired' })
      .eq('id', boost.id);
    await adminSupabase()
      .from('used_gear_listings')
      .update({ boost_status: null, boost_expires_at: null })
      .eq('id', boost.listing_id);
    setSaving(false);
    await fetchBoosts();
    showFeedback('Boost expired.');
  };

  const saveBoostSettings = async () => {
    const price = parseFloat(boostPrice);
    const days = parseInt(boostDuration, 10);
    const discount = parseInt(reboostDiscountPct, 10);
    if (isNaN(price) || price <= 0 || isNaN(days) || days < 1) {
      setSettingsMsg('Enter valid price and duration.');
      return;
    }
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setSettingsMsg('Re-boost discount must be 0–100.');
      return;
    }
    setSavingSettings(true);
    await adminSupabase()
      .from('site_settings')
      .upsert([
        { key: 'boost_price_usd', value: price.toFixed(2) },
        { key: 'boost_duration_days', value: String(days) },
        { key: 'reboost_discount_pct', value: String(discount) },
      ], { onConflict: 'key' });
    setSavingSettings(false);
    setSettingsMsg('Settings saved.');
    setTimeout(() => setSettingsMsg(''), 2500);
  };

  const pendingCount = listings.filter((l) => l.status === 'pending').length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;
  const pendingBoostsCount = boosts.filter((b) => b.status === 'pending_approval').length;

  // ── Listing detail view ──────────────────────────────────────────────────
  if (selected) {
    const thumb = selected.main_image_url || selected.images?.[0];
    const condColor = CONDITION_COLORS[selected.condition] ?? Colors.textMuted;

    return (
      <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={() => setSelected(null)} activeOpacity={0.7}>
          <Text style={styles.backLink}>← {t.back}</Text>
        </TouchableOpacity>

        <View style={styles.detailImageWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.detailImage} resizeMode="cover" />
          ) : (
            <View style={styles.detailImagePlaceholder}>
              <Tag size={40} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
          )}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selected.title}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailMeta}>{selected.category} · </Text>
            <Text style={[styles.detailMeta, { color: condColor }]}>
              {conditionLabel(selected.condition, t)}
            </Text>
          </View>
          <Text style={styles.detailPrice}>${Number(selected.price).toLocaleString()}</Text>
          <Text style={styles.detailEmail}>{selected.user_email}</Text>
          <Text style={styles.detailContact}>{selected.contact}</Text>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selected.status] ?? Colors.textMuted) + '22' }]}>
            <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[selected.status] ?? Colors.textMuted }]}>
              {selected.status}
            </Text>
          </View>
          {selected.description ? (
            <Text style={styles.detailDesc}>{selected.description}</Text>
          ) : null}
        </View>

        <View style={styles.sellerCard}>
          <View style={styles.sellerCardRow}>
            <Text style={styles.sellerCardTitle}>{t.sellerInfo}</Text>
            {(sellerProfile?.is_verified || selected.seller_verified) && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={12} color={Colors.neonBlue} strokeWidth={2.5} />
                <Text style={styles.verifiedBadgeText}>{t.verifiedSeller}</Text>
              </View>
            )}
          </View>
          {sellerProfile ? (
            <View style={styles.sellerStats}>
              <Text style={styles.sellerStatText}>
                {t.totalListings}: <Text style={styles.sellerStatVal}>{sellerProfile.total_listings}</Text>
              </Text>
              <Text style={styles.sellerStatText}>
                {t.memberSince}: <Text style={styles.sellerStatVal}>
                  {new Date(sellerProfile.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </Text>
              </Text>
              {sellerProfile.rating_count > 0 ? (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={13}
                      color={s <= Math.round(sellerProfile.avg_rating) ? Colors.gold : Colors.textMuted}
                      fill={s <= Math.round(sellerProfile.avg_rating) ? Colors.gold : 'transparent'}
                      strokeWidth={1.5}
                    />
                  ))}
                  <Text style={styles.ratingText}>
                    {Number(sellerProfile.avg_rating).toFixed(1)} ({sellerProfile.rating_count})
                  </Text>
                </View>
              ) : (
                <Text style={styles.noRatingText}>{t.noRatingsYet}</Text>
              )}
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              styles.verifyBtn,
              (sellerProfile?.is_verified || selected.seller_verified) && styles.verifyBtnActive,
              saving && styles.btnDisabled,
            ]}
            onPress={toggleVerified}
            activeOpacity={0.8}
            disabled={saving}
          >
            <BadgeCheck
              size={15}
              color={(sellerProfile?.is_verified || selected.seller_verified) ? Colors.neonBlue : Colors.textMuted}
              strokeWidth={2.5}
            />
            <Text style={[
              styles.verifyBtnText,
              (sellerProfile?.is_verified || selected.seller_verified) && styles.verifyBtnTextActive,
            ]}>
              {(sellerProfile?.is_verified || selected.seller_verified) ? t.unmarkVerified : t.markVerified}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subTitle}>{t.adminNote}</Text>
        <TextInput
          style={styles.noteInput}
          value={adminNote}
          onChangeText={setAdminNote}
          placeholder={t.adminNotePlaceholder}
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
        />

        <View style={styles.actionRow}>
          {/* Approve: pending only, or rejected-and-resubmitted (status===pending after edit) */}
          {selected.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn, saving && styles.btnDisabled]}
              onPress={() => updateStatus(selected.id, 'approved')}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.success} />
              ) : (
                <>
                  <Check size={16} color={Colors.success} strokeWidth={2.5} />
                  <Text style={[styles.actionBtnText, { color: Colors.success }]}>{t.approveListing}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Reject: pending or approved */}
          {(selected.status === 'pending' || selected.status === 'approved') && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn, saving && styles.btnDisabled]}
              onPress={() => { setRejectReason(''); setRejectReasonError(''); setShowRejectModal(true); }}
              activeOpacity={0.8}
              disabled={saving}
            >
              <CircleX size={16} color={Colors.warning} strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: Colors.warning }]}>{t.rejectListing}</Text>
            </TouchableOpacity>
          )}

          {/* Mark as Available: sold only */}
          {selected.status === 'sold' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn, saving && styles.btnDisabled]}
              onPress={() => updateStatus(selected.id, 'approved')}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.success} />
              ) : (
                <>
                  <Check size={16} color={Colors.success} strokeWidth={2.5} />
                  <Text style={[styles.actionBtnText, { color: Colors.success }]}>Mark as Available</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Delete: always */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn, saving && styles.btnDisabled]}
            onPress={() => deleteListing(selected.id)}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Trash2 size={16} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {showRejectModal && (
          <View style={styles.rejectModal}>
            <Text style={styles.rejectModalTitle}>Rejection Reason</Text>
            <Text style={styles.rejectModalSubtitle}>
              Explain to the seller why this listing was rejected. This will be shown in their profile.
            </Text>
            <TextInput
              style={[styles.noteInput, rejectReasonError ? { borderColor: Colors.error } : null]}
              value={rejectReason}
              onChangeText={(v) => { setRejectReason(v); setRejectReasonError(''); }}
              placeholder="e.g. Photos are unclear, please add better images showing the full rig and all components."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              autoFocus
            />
            {rejectReasonError !== '' && (
              <Text style={styles.rejectReasonError}>{rejectReasonError}</Text>
            )}
            <View style={styles.rejectModalActions}>
              <TouchableOpacity
                style={styles.rejectModalCancelBtn}
                onPress={() => setShowRejectModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.rejectModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectModalConfirmBtn, saving && styles.btnDisabled]}
                onPress={async () => {
                  if (!rejectReason.trim()) {
                    setRejectReasonError('A rejection reason is required.');
                    return;
                  }
                  setShowRejectModal(false);
                  await updateStatus(selected.id, 'rejected', rejectReason.trim());
                  setAdminNote(rejectReason.trim());
                }}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.rejectModalConfirmText}>Reject Listing</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {successMsg !== '' && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Main tabbed view ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRow}
      >
        {ADMIN_TABS.map((tab) => {
          const badge =
            tab === 'listings' ? pendingCount :
            tab === 'reports' ? pendingReportsCount :
            tab === 'boosts' ? pendingBoostsCount : 0;
          const icons: Record<AdminTab, React.ReactNode> = {
            listings: <Tag size={14} color={activeTab === tab ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />,
            reports: <Flag size={14} color={activeTab === tab ? Colors.error : Colors.textMuted} strokeWidth={2} />,
            boosts: <Zap size={14} color={activeTab === tab ? Colors.gold : Colors.textMuted} strokeWidth={2} />,
            settings: <Settings size={14} color={activeTab === tab ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />,
          };
          const labels: Record<AdminTab, string> = {
            listings: 'Listings',
            reports: 'Reports',
            boosts: 'Boosts',
            settings: 'Boost Settings',
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              {icons[tab]}
              <Text style={[styles.tabChipText, activeTab === tab && styles.tabChipTextActive]}>
                {labels[tab]}
                {badge > 0 ? ` (${badge})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── LISTINGS TAB ── */}
      {activeTab === 'listings' && (
        <View>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={16} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t.search + '...'}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search !== '' && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {STATUS_FILTERS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                  {s === 'all' ? t.all : t[`listing${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof typeof t] ?? s}
                  {s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingListings ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.neonBlue} size="large" />
            </View>
          ) : (() => {
            const filtered = listings.filter((l) => {
              const matchSearch =
                search.trim() === '' ||
                l.title.toLowerCase().includes(search.toLowerCase()) ||
                l.user_email.toLowerCase().includes(search.toLowerCase());
              const matchStatus = statusFilter === 'all' || l.status === statusFilter;
              return matchSearch && matchStatus;
            });
            return filtered.length === 0 ? (
              <Text style={styles.emptyText}>{t.noListingsFound}</Text>
            ) : (
              <>
                {filtered.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.listingRow}
                    onPress={() => openListing(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.listingThumbWrap}>
                      {(item.main_image_url || item.images?.[0]) ? (
                        <Image source={{ uri: item.main_image_url || item.images![0] }} style={styles.listingThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.listingThumb, styles.listingThumbPlaceholder]}>
                          <Tag size={18} color={Colors.textMuted} strokeWidth={1.5} />
                        </View>
                      )}
                    </View>
                    <View style={styles.listingInfo}>
                      <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.listingMeta}>{item.user_email}</Text>
                      <Text style={styles.listingDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.listingRight}>
                      <Text style={styles.listingPrice}>${Number(item.price).toLocaleString()}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? Colors.textMuted) + '22' }]}>
                        <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[item.status] ?? Colors.textMuted }]}>
                          {item.status}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            );
          })()}
        </View>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === 'reports' && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {(['pending', 'dismissed', 'all'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, reportStatusFilter === s && styles.filterChipActive]}
                onPress={() => setReportStatusFilter(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, reportStatusFilter === s && styles.filterChipTextActive]}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  {s === 'pending' && pendingReportsCount > 0 ? ` (${pendingReportsCount})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingReports ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.neonBlue} size="large" />
            </View>
          ) : (() => {
            const filtered = reports.filter((r) =>
              reportStatusFilter === 'all' || r.status === reportStatusFilter
            );
            return filtered.length === 0 ? (
              <Text style={styles.emptyText}>No reports found.</Text>
            ) : (
              <>
                {filtered.map((report) => (
                  <View key={report.id} style={styles.reportCard}>
                    <View style={styles.reportCardHeader}>
                      <View style={styles.reportReasonBadge}>
                        <Flag size={11} color={Colors.error} strokeWidth={2.5} />
                        <Text style={styles.reportReasonText}>{report.reason}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: (report.status === 'pending' ? Colors.warning : Colors.textMuted) + '22' }
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          { color: report.status === 'pending' ? Colors.warning : Colors.textMuted }
                        ]}>
                          {report.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.reportListingTitle} numberOfLines={1}>
                      Listing: {report.listing_title}
                    </Text>

                    {report.message ? (
                      <Text style={styles.reportMessage}>"{report.message}"</Text>
                    ) : null}

                    <View style={styles.reportMeta}>
                      <Text style={styles.reportMetaText}>{report.reporter_email}</Text>
                      {report.reporter_phone ? (
                        <Text style={styles.reportMetaText}>{report.reporter_phone}</Text>
                      ) : null}
                      <Text style={styles.reportMetaText}>
                        {new Date(report.created_at).toLocaleDateString()}
                      </Text>
                    </View>

                    {report.status === 'pending' && (
                      <View style={styles.reportActions}>
                        {report.reporter_phone ? (
                          <TouchableOpacity
                            style={styles.reportActionBtn}
                            onPress={() => openWhatsApp(report.reporter_phone, report.listing_title ?? '')}
                            activeOpacity={0.8}
                          >
                            <MessageSquare size={13} color={Colors.success} strokeWidth={2.5} />
                            <Text style={[styles.reportActionText, { color: Colors.success }]}>WhatsApp</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={styles.reportActionBtn}
                          onPress={() => hideListingFromReport(report.id, report.listing_id)}
                          activeOpacity={0.8}
                        >
                          <EyeOff size={13} color={Colors.error} strokeWidth={2.5} />
                          <Text style={[styles.reportActionText, { color: Colors.error }]}>Hide Listing</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.reportActionBtn}
                          onPress={() => dismissReport(report.id)}
                          activeOpacity={0.8}
                        >
                          <CheckCheck size={13} color={Colors.textMuted} strokeWidth={2.5} />
                          <Text style={[styles.reportActionText, { color: Colors.textMuted }]}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            );
          })()}
        </View>
      )}

      {/* ── BOOSTS TAB ── */}
      {activeTab === 'boosts' && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {(['pending_approval', 'active', 'rejected', 'expired', 'all'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, boostStatusFilter === s && styles.filterChipActive]}
                onPress={() => setBoostStatusFilter(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, boostStatusFilter === s && styles.filterChipTextActive]}>
                  {s === 'all' ? 'All'
                    : s === 'pending_approval' ? `Pending Approval${pendingBoostsCount > 0 ? ` (${pendingBoostsCount})` : ''}`
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingBoosts ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.neonBlue} size="large" />
            </View>
          ) : (() => {
            const filtered = boosts.filter((b) =>
              boostStatusFilter === 'all' || b.status === boostStatusFilter
            );
            return filtered.length === 0 ? (
              <Text style={styles.emptyText}>No boost requests found.</Text>
            ) : (
              <>
                {filtered.map((boost) => {
                  const statusColor =
                    boost.status === 'pending_approval' ? Colors.warning :
                    boost.status === 'active' ? Colors.success :
                    boost.status === 'rejected' ? Colors.error :
                    Colors.textMuted;
                  const statusLabel =
                    boost.status === 'pending_approval' ? 'Pending Approval' :
                    boost.status === 'active' ? 'Active' :
                    boost.status === 'rejected' ? 'Rejected' :
                    boost.status === 'expired' ? 'Expired' : boost.status;

                  return (
                    <View key={boost.id} style={styles.boostCard}>
                      <View style={styles.boostCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                          <Zap size={14} color={Colors.gold} strokeWidth={2.5} />
                          <Text style={styles.boostListingTitle} numberOfLines={1}>{boost.listing_title}</Text>
                          {boost.is_reboost && (
                            <View style={styles.reboostTag}>
                              <Text style={styles.reboostTagText}>RE-BOOST</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.boostMeta}>{boost.listing_user_email}</Text>
                      <View style={styles.boostDetails}>
                        <Text style={styles.boostDetailText}>Duration: {boost.duration_days} days</Text>
                        {boost.price_paid != null && (
                          <Text style={styles.boostDetailText}>Price: ${boost.price_paid}</Text>
                        )}
                        {boost.expires_at && (
                          <Text style={styles.boostDetailText}>
                            Expires: {new Date(boost.expires_at).toLocaleDateString()}
                          </Text>
                        )}
                        <Text style={styles.boostDetailText}>
                          Requested: {new Date(boost.created_at).toLocaleDateString()}
                        </Text>
                        {boost.admin_note && boost.status === 'rejected' && (
                          <Text style={[styles.boostDetailText, { color: Colors.error }]}>
                            Reason: {boost.admin_note}
                          </Text>
                        )}
                      </View>

                      <View style={styles.reportActions}>
                        {boost.status === 'pending_approval' && (
                          <>
                            <TouchableOpacity
                              style={[styles.boostActivateBtn, saving && styles.btnDisabled]}
                              onPress={() => approveBoost(boost)}
                              activeOpacity={0.8}
                              disabled={saving}
                            >
                              <Check size={13} color={Colors.gold} strokeWidth={2.5} />
                              <Text style={styles.boostActivateText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reportActionBtn, saving && styles.btnDisabled]}
                              onPress={() => { setBoostRejectTarget(boost); setBoostRejectReason(''); setBoostRejectError(''); }}
                              activeOpacity={0.8}
                              disabled={saving}
                            >
                              <CircleX size={13} color={Colors.error} strokeWidth={2.5} />
                              <Text style={[styles.reportActionText, { color: Colors.error }]}>Reject</Text>
                            </TouchableOpacity>
                          </>
                        )}
                        {boost.status === 'active' && (
                          <TouchableOpacity
                            style={[styles.reportActionBtn, saving && styles.btnDisabled]}
                            onPress={() => expireBoost(boost)}
                            activeOpacity={0.8}
                            disabled={saving}
                          >
                            <X size={13} color={Colors.error} strokeWidth={2.5} />
                            <Text style={[styles.reportActionText, { color: Colors.error }]}>Expire Boost</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Inline reject reason form */}
                      {boostRejectTarget?.id === boost.id && (
                        <View style={styles.boostRejectForm}>
                          <Text style={styles.boostRejectFormTitle}>Rejection Reason (optional)</Text>
                          <TextInput
                            style={[styles.noteInput, boostRejectError ? { borderColor: Colors.error } : null]}
                            value={boostRejectReason}
                            onChangeText={(v) => { setBoostRejectReason(v); setBoostRejectError(''); }}
                            placeholder="e.g. Payment not received, please contact support."
                            placeholderTextColor={Colors.textMuted}
                            multiline
                            numberOfLines={2}
                            autoFocus
                          />
                          {boostRejectError !== '' && (
                            <Text style={styles.rejectReasonError}>{boostRejectError}</Text>
                          )}
                          <View style={styles.rejectModalActions}>
                            <TouchableOpacity
                              style={styles.rejectModalCancelBtn}
                              onPress={() => setBoostRejectTarget(null)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.rejectModalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.rejectModalConfirmBtn, saving && styles.btnDisabled]}
                              onPress={() => rejectBoost(boost, boostRejectReason.trim())}
                              activeOpacity={0.8}
                              disabled={saving}
                            >
                              {saving ? (
                                <ActivityIndicator size="small" color={Colors.white} />
                              ) : (
                                <Text style={styles.rejectModalConfirmText}>Confirm Reject</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            );
          })()}
        </View>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Zap size={18} color={Colors.gold} strokeWidth={2.5} />
            <Text style={styles.settingsTitle}>Boost Settings</Text>
          </View>
          <Text style={styles.settingsSubtitle}>
            These values are shown to sellers when they request a boost. Update them here and they take effect immediately.
          </Text>

          <Text style={styles.settingsLabel}>Boost Price (USD)</Text>
          <TextInput
            style={styles.settingsInput}
            value={boostPrice}
            onChangeText={setBoostPrice}
            placeholder="9.99"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={styles.settingsLabel}>Boost Duration (days)</Text>
          <TextInput
            style={styles.settingsInput}
            value={boostDuration}
            onChangeText={setBoostDuration}
            placeholder="7"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />

          <Text style={styles.settingsLabel}>Re-boost Discount (%)</Text>
          <Text style={styles.settingsHint}>
            Sellers who re-boost an existing or expired boost pay this % less. e.g. 50 = half price.
          </Text>
          <TextInput
            style={styles.settingsInput}
            value={reboostDiscountPct}
            onChangeText={setReboostDiscountPct}
            placeholder="50"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={[styles.saveSettingsBtn, savingSettings && styles.btnDisabled]}
            onPress={saveBoostSettings}
            activeOpacity={0.8}
            disabled={savingSettings}
          >
            {savingSettings ? (
              <ActivityIndicator size="small" color={Colors.gold} />
            ) : (
              <Text style={styles.saveSettingsBtnText}>Save Settings</Text>
            )}
          </TouchableOpacity>

          {settingsMsg !== '' && (
            <View style={[styles.successBanner, { marginTop: Spacing.sm }]}>
              <Text style={styles.successText}>{settingsMsg}</Text>
            </View>
          )}
        </View>
      )}

      {successMsg !== '' && activeTab !== 'listings' && (
        <View style={[styles.successBanner, { marginTop: Spacing.md }]}>
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      )}
    </View>
  );
}

function MarketplaceScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.adminMarketplace} showBack>
        <MarketplaceContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.adminMarketplace}>
      <MarketplaceContent />
    </AdminWebDashboard>
  );
}

export default function MarketplaceScreenGuarded() {
  return (
    <AdminGuard permission="manage_orders">
      <MarketplaceScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  tabScroll: {
    marginBottom: Spacing.md,
  },
  tabRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  tabChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: Colors.neonBlue,
  },
  searchRow: {
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: Colors.neonBlue,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  listingThumbWrap: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    flexShrink: 0,
  },
  listingThumb: {
    width: 60,
    height: 60,
  },
  listingThumbPlaceholder: {
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: {
    flex: 1,
    gap: 2,
  },
  listingTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  listingMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  listingDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  listingRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  listingPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  detailScroll: {
    flex: 1,
  },
  backRow: {
    marginBottom: Spacing.md,
  },
  backLink: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  detailImageWrap: {
    width: '100%',
    height: 200,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: Spacing.md,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: 4,
  },
  detailTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
  },
  detailPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
    marginTop: 4,
  },
  detailEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  detailContact: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  detailDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  subTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  noteInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  approveBtn: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '18',
  },
  rejectBtn: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '18',
  },
  deleteBtn: {
    flex: 0,
    width: 48,
    borderColor: Colors.error,
    backgroundColor: Colors.errorDim,
    paddingHorizontal: 0,
  },
  actionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sellerCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sellerCardRow: {
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
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verifiedBadgeText: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '800',
  },
  sellerStats: {
    gap: 4,
  },
  sellerStatText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  sellerStatVal: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    color: Colors.gold,
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
  },
  noRatingText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    alignSelf: 'flex-start',
  },
  verifyBtnActive: {
    borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  verifyBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  verifyBtnTextActive: {
    color: Colors.neonBlue,
  },
  successBanner: {
    backgroundColor: Colors.success + '18',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  rejectModal: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.35)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  rejectModalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  rejectModalSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  rejectReasonError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  rejectModalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  rejectModalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  rejectModalCancelText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  rejectModalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '18',
    alignItems: 'center',
  },
  rejectModalConfirmText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  // Reports
  reportCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  reportReasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error + '18',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reportReasonText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  reportListingTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  reportMessage: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reportMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportMetaText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  reportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  reportActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  reportActionText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  // Boosts
  boostCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  boostCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  boostListingTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    flex: 1,
  },
  boostMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  boostDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  boostDetailText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  boostActivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  boostActivateText: {
    color: Colors.gold,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  reboostTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  reboostTagText: {
    color: Colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  boostRejectForm: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error + '44',
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: 4,
  },
  boostRejectFormTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  // Settings
  settingsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  settingsTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  settingsSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  settingsLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingsHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginBottom: 6,
  },
  settingsInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  saveSettingsBtn: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveSettingsBtnText: {
    color: Colors.gold,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
