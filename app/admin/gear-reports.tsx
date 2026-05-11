import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import {
  Flag,
  X,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  MessageSquare,
  ExternalLink,
} from 'lucide-react-native';
import { supabase, adminSupabase } from '@/lib/supabase';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportStatus = 'new' | 'reviewing' | 'resolved' | 'dismissed';

type GearReport = {
  id: string;
  listing_id: string;
  reported_user_id: string | null;
  reporter_user_id: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  // joined
  listing_title?: string;
  listing_status?: string;
  reporter_email?: string;
  reported_email?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  scam: 'Scam / احتيال',
  fake_item: 'Fake item / منتج مزيف',
  wrong_info: 'Wrong information / معلومات غير صحيحة',
  unsafe: 'Unsafe item / منتج غير آمن',
  suspicious_seller: 'Suspicious seller / بائع مشبوه',
  other: 'Other / أخرى',
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  new:        { label: 'New',        color: Colors.neonBlue,  bg: Colors.neonBlueGlow },
  reviewing:  { label: 'Reviewing',  color: Colors.warning,   bg: Colors.warning + '1A' },
  resolved:   { label: 'Resolved',   color: Colors.success,   bg: Colors.success + '1A' },
  dismissed:  { label: 'Dismissed',  color: Colors.textMuted, bg: Colors.backgroundInput },
};

const STATUS_OPTIONS: ReportStatus[] = ['new', 'reviewing', 'resolved', 'dismissed'];
const FILTER_OPTIONS = ['all', ...STATUS_OPTIONS] as const;

// ─── Main Content ─────────────────────────────────────────────────────────────

function GearReportsContent() {
  const [reports, setReports] = useState<GearReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('all');
  const [selected, setSelected] = useState<GearReport | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminSupabase()
      .from('used_gear_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast(error.message, 'error');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as GearReport[];

    // Enrich with listing titles and user emails
    const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))];
    const reporterIds = [...new Set(rows.map((r) => r.reporter_user_id).filter(Boolean))];
    const reportedIds = [...new Set(rows.map((r) => r.reported_user_id).filter(Boolean))];

    const [listingsRes, profilesRes] = await Promise.all([
      listingIds.length > 0
        ? adminSupabase()
            .from('used_gear_listings')
            .select('id, title, status')
            .in('id', listingIds)
        : Promise.resolve({ data: [] }),
      reporterIds.length + reportedIds.length > 0
        ? adminSupabase()
            .from('user_profiles')
            .select('user_id, email')
            .in('user_id', [...new Set([...reporterIds, ...reportedIds])])
        : Promise.resolve({ data: [] }),
    ]);

    const listingMap: Record<string, { title: string; status: string }> = {};
    for (const l of (listingsRes.data ?? []) as { id: string; title: string; status: string }[]) {
      listingMap[l.id] = { title: l.title, status: l.status };
    }

    const profileMap: Record<string, string> = {};
    for (const p of (profilesRes.data ?? []) as { user_id: string; email: string }[]) {
      profileMap[p.user_id] = p.email;
    }

    const enriched = rows.map((r) => ({
      ...r,
      listing_title: listingMap[r.listing_id]?.title ?? r.listing_id,
      listing_status: listingMap[r.listing_id]?.status,
      reporter_email: profileMap[r.reporter_user_id] ?? r.reporter_user_id,
      reported_email: r.reported_user_id ? (profileMap[r.reported_user_id] ?? r.reported_user_id) : undefined,
    }));

    setReports(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleUpdateStatus = async (report: GearReport, status: ReportStatus) => {
    setUpdatingStatus(true);
    const { error } = await adminSupabase()
      .from('used_gear_reports')
      .update({ status })
      .eq('id', report.id);
    setUpdatingStatus(false);
    if (error) { showToast(error.message, 'error'); return; }
    setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status } : r));
    if (selected?.id === report.id) setSelected((s) => s ? { ...s, status } : s);
    showToast('Status updated');
  };

  const handleSaveAdminNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    const { error } = await adminSupabase()
      .from('used_gear_reports')
      .update({ admin_note: adminNote.trim() || null })
      .eq('id', selected.id);
    setSavingNote(false);
    if (error) { showToast(error.message, 'error'); return; }
    setReports((prev) => prev.map((r) => r.id === selected.id ? { ...r, admin_note: adminNote.trim() || null } : r));
    setSelected((s) => s ? { ...s, admin_note: adminNote.trim() || null } : s);
    showToast('Note saved');
  };

  const handleToggleListingVisibility = async (report: GearReport) => {
    if (!report.listing_status) return;
    const newStatus = report.listing_status === 'hidden' ? 'approved' : 'hidden';
    const { error } = await adminSupabase()
      .from('used_gear_listings')
      .update({ status: newStatus })
      .eq('id', report.listing_id);
    if (error) { showToast(error.message, 'error'); return; }
    setReports((prev) =>
      prev.map((r) => r.listing_id === report.listing_id ? { ...r, listing_status: newStatus } : r)
    );
    if (selected?.listing_id === report.listing_id) {
      setSelected((s) => s ? { ...s, listing_status: newStatus } : s);
    }
    showToast(newStatus === 'hidden' ? 'Listing hidden' : 'Listing restored');
  };

  const openDetail = (report: GearReport) => {
    setSelected(report);
    setAdminNote(report.admin_note ?? '');
  };

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = reports.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.md }}>
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f;
          const count = f === 'all' ? reports.length : counts[f] ?? 0;
          const cfg = f !== 'all' ? STATUS_CONFIG[f as ReportStatus] : null;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                active && { borderColor: cfg?.color ?? Colors.neonBlue, backgroundColor: cfg?.bg ?? Colors.neonBlueGlow },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, active && { color: cfg?.color ?? Colors.neonBlue, fontWeight: '800' }]}>
                {f === 'all' ? 'All' : STATUS_CONFIG[f as ReportStatus].label}
              </Text>
              {count > 0 && (
                <View style={[styles.badge, { backgroundColor: active ? (cfg?.color ?? Colors.neonBlue) : Colors.border }]}>
                  <Text style={[styles.badgeText, { color: active ? Colors.background : Colors.textMuted }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchReports} activeOpacity={0.8}>
          <RefreshCw size={14} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Flag size={40} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No reports</Text>
          <Text style={styles.emptySub}>
            {filter === 'all' ? 'No gear reports have been submitted yet.' : `No ${filter} reports.`}
          </Text>
        </View>
      ) : (
        filtered.map((report) => {
          const cfg = STATUS_CONFIG[report.status];
          return (
            <TouchableOpacity
              key={report.id}
              style={styles.card}
              onPress={() => openDetail(report)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{report.listing_title}</Text>
                  <Text style={styles.cardReason}>{REASON_LABELS[report.reason] ?? report.reason}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + '66' }]}>
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>
                  Reporter: <Text style={{ color: Colors.textSecondary }}>{report.reporter_email}</Text>
                </Text>
                <Text style={styles.metaText}>
                  {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              {report.note && (
                <Text style={styles.notePreview} numberOfLines={1}>"{report.note}"</Text>
              )}
              {report.listing_status === 'hidden' && (
                <View style={styles.hiddenBadge}>
                  <EyeOff size={11} color={Colors.error} strokeWidth={2} />
                  <Text style={{ color: Colors.error, fontSize: 10, fontWeight: '700' }}>Listing hidden</Text>
                </View>
              )}
              <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} style={{ position: 'absolute', right: Spacing.md, top: '50%' } as any} />
            </TouchableOpacity>
          );
        })
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)} activeOpacity={0.7}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Listing */}
                <Section label="Listing">
                  <Row label="Title" value={selected.listing_title ?? selected.listing_id} />
                  <Row label="Status" value={selected.listing_status ?? '—'} />
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => {
                        const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://skydiverstore.com';
                        Linking.openURL(`${base}/marketplace/${selected.listing_id}`).catch(() => {});
                      }}
                      activeOpacity={0.8}
                    >
                      <ExternalLink size={13} color={Colors.neonBlue} strokeWidth={2} />
                      <Text style={styles.linkText}>Open listing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.linkBtn, { borderColor: selected.listing_status === 'hidden' ? Colors.success + '66' : Colors.error + '66' }]}
                      onPress={() => handleToggleListingVisibility(selected)}
                      activeOpacity={0.8}
                    >
                      {selected.listing_status === 'hidden'
                        ? <Eye size={13} color={Colors.success} strokeWidth={2} />
                        : <EyeOff size={13} color={Colors.error} strokeWidth={2} />
                      }
                      <Text style={{ color: selected.listing_status === 'hidden' ? Colors.success : Colors.error, fontSize: FontSize.xs, fontWeight: '700' }}>
                        {selected.listing_status === 'hidden' ? 'Unhide listing' : 'Hide listing'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Section>

                {/* People */}
                <Section label="People">
                  <Row label="Reporter" value={selected.reporter_email ?? selected.reporter_user_id} />
                  {selected.reported_email && <Row label="Reported seller" value={selected.reported_email} />}
                </Section>

                {/* Report details */}
                <Section label="Report">
                  <Row label="Reason" value={REASON_LABELS[selected.reason] ?? selected.reason} />
                  {selected.note && <Row label="Note" value={selected.note} />}
                  <Row label="Submitted" value={new Date(selected.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} />
                </Section>

                {/* Status */}
                <Section label="Status">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STATUS_OPTIONS.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const active = selected.status === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.statusBtn, active && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                          onPress={() => handleUpdateStatus(selected, s)}
                          disabled={updatingStatus || active}
                          activeOpacity={0.8}
                        >
                          {updatingStatus && active
                            ? <ActivityIndicator size="small" color={cfg.color} />
                            : <Text style={[styles.statusBtnText, active && { color: cfg.color, fontWeight: '800' }]}>{cfg.label}</Text>
                          }
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Section>

                {/* Admin note */}
                <Section label="Admin Note">
                  <TextInput
                    style={styles.noteInput}
                    value={adminNote}
                    onChangeText={setAdminNote}
                    placeholder="Internal note visible only to admins..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[styles.saveNoteBtn, savingNote && { opacity: 0.5 }]}
                    onPress={handleSaveAdminNote}
                    disabled={savingNote}
                    activeOpacity={0.8}
                  >
                    {savingNote
                      ? <ActivityIndicator size="small" color={Colors.background} />
                      : <Text style={styles.saveNoteBtnText}>Save Note</Text>
                    }
                  </TouchableOpacity>
                </Section>

                <View style={{ height: Spacing.xl }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={sectionLabelStyle}>{label}</Text>
      <View style={sectionBodyStyle}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyle}>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue} selectable>{value}</Text>
    </View>
  );
}

const sectionLabelStyle: any = {
  color: Colors.textMuted,
  fontSize: FontSize.xs,
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 6,
};
const sectionBodyStyle: any = {
  backgroundColor: Colors.backgroundSecondary,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Colors.border,
  overflow: 'hidden',
  padding: Spacing.sm,
  gap: 4,
};
const rowStyle: any = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.borderLight };
const rowLabel: any = { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', flex: 1 };
const rowValue: any = { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '600', flex: 2, textAlign: 'right' };

// ─── Wrappers ─────────────────────────────────────────────────────────────────

function GearReportsWeb() {
  return (
    <AdminWebDashboard title="تقييمات الزباين للمستعمل" subtitle="Used gear marketplace reports">
      <GearReportsContent />
    </AdminWebDashboard>
  );
}

function GearReportsMobile() {
  return (
    <AdminMobileDashboard title="تقييمات الزباين للمستعمل">
      <GearReportsContent />
    </AdminMobileDashboard>
  );
}

export default function GearReportsScreen() {
  const { isMobile } = useAdminLayout();
  return (
    <AdminGuard>
      {isMobile ? <GearReportsMobile /> : <GearReportsWeb />}
    </AdminGuard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundInput,
  },
  filterText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.backgroundInput, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: 64, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  emptySub: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },

  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm, gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  cardReason: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { color: Colors.textMuted, fontSize: FontSize.xs },
  notePreview: { color: Colors.textSecondary, fontSize: FontSize.xs, fontStyle: 'italic' },
  hiddenBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.error + '14', borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.error + '40',
    paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start',
  },

  statusPill: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '800' },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 540,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg },

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 6, flexWrap: 'wrap' },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  linkText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },

  statusBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundInput,
  },
  statusBtnText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },

  noteInput: {
    backgroundColor: Colors.backgroundInput, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    minHeight: 72,
    marginBottom: Spacing.sm,
  },
  saveNoteBtn: {
    backgroundColor: Colors.neonBlue, borderRadius: Radius.md,
    paddingVertical: 11, alignItems: 'center',
  },
  saveNoteBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
});
