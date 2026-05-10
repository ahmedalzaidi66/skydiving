import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Switch,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import {
  Save,
  Image as ImageIcon,
  Video,
  Type,
  MousePointerClick,
  Star,
  MessageSquare,
  Wind,
  Globe,
  LayoutGrid as Layout,
  RotateCcw,
  CircleCheck as CheckCircle,
  Eye,
  EyeOff,
  Smartphone,
  SlidersHorizontal,
  Layers,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Link,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import ImageUploader from '@/components/admin/ImageUploader';
import { supabase, adminSupabase } from '@/lib/supabase';
import { autoTranslate } from '@/lib/translate';
import { useCMS, CMSContent, DEFAULT_BRANDING } from '@/context/CMSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import HeroLivePreview, { HeroPreviewState } from '@/components/admin/HeroLivePreview';
import { HeroSlide } from '@/components/HeroSlider';

type BrandingMap = Record<string, string>;

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'ar', label: 'AR', full: 'العربية' },
  { code: 'es', label: 'ES', full: 'Español' },
  { code: 'de', label: 'DE', full: 'Deutsch' },
  { code: 'ru', label: 'RU', full: 'Русский' },
];

type Tab = 'branding' | 'hero' | 'slides' | 'featured' | 'canopy' | 'testimonials' | 'footer';
const TAB_IDS: Tab[] = ['branding', 'hero', 'slides', 'featured', 'canopy', 'testimonials', 'footer'];

const DEFAULT_CONTENT_EN: CMSContent = {
  hero: {
    image_url: 'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800',
    badge_text: 'PROFESSIONAL GRADE',
    title: 'Tested in Real Skydives',
    subtitle: 'Gear trusted by 10,000+ skydivers worldwide',
    cta_primary: 'Shop Now',
    cta_secondary: 'View Featured',
    overlay_color: 'rgba(5,10,20,0.55)',
  },
  featured: { title: 'Featured Gear', subtitle: 'Hand-picked by our experts', enabled: 'true' },
  canopy: {
    title: 'Find Your Canopy',
    subtitle: 'Use our expert tool to find the right canopy for your experience level.',
    cta_text: 'Use Canopy Advisor',
    enabled: 'true',
  },
  testimonials: { title: 'Trusted by Skydivers', subtitle: 'Hear from our community', enabled: 'true' },
  footer: {
    tagline: 'Professional skydiving equipment trusted worldwide.',
    copyright: '© 2026 Skydiver Man Gear. All rights reserved.',
    logo_url: '',
    col1_title: 'Shop',
    col2_title: 'Company',
    col3_title: 'Support',
    contact_email: 'support@skydivermagear.com',
    contact_phone: '+1 (800) 555-0199',
  },
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_WIDE = SCREEN_WIDTH > 900;

// ─── Overlay Slider (web-native range input) ──────────────────────────────────

function OverlaySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  if (Platform.OS !== 'web') {
    return (
      <View style={sliderStyles.row}>
        {[0.2, 0.4, 0.5, 0.6, 0.7, 0.8].map((v) => (
          <TouchableOpacity
            key={v}
            style={[sliderStyles.preset, value === v && sliderStyles.presetActive]}
            onPress={() => onChange(v)}
            activeOpacity={0.8}
          >
            <Text style={[sliderStyles.presetText, value === v && sliderStyles.presetTextActive]}>
              {Math.round(v * 100)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  return (
    <View style={sliderStyles.wrapper}>
      {/* @ts-ignore — web-only input[type=range] */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#00BFFF',
          cursor: 'pointer',
          height: 4,
        }}
      />
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.labelText}>0%</Text>
        <Text style={[sliderStyles.labelText, { color: '#00BFFF', fontWeight: '700' }]}>
          {Math.round(value * 100)}%
        </Text>
        <Text style={sliderStyles.labelText}>100%</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: { width: '100%', gap: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  labelText: { color: Colors.textMuted, fontSize: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  presetActive: { borderColor: Colors.neonBlue, backgroundColor: 'rgba(0,191,255,0.1)' },
  presetText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  presetTextActive: { color: Colors.neonBlue },
});

// ─── Hero Slides Editor ───────────────────────────────────────────────────────

const BLANK_SLIDE: Omit<HeroSlide, 'id' | 'created_at' | 'updated_at'> = {
  image_url: '',
  title: '',
  subtitle: '',
  badge: '',
  button_text: 'Shop Now',
  button_url: '/(tabs)/products',
  sort_order: 0,
  is_active: true,
};

function HeroSlidesEditorSection() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveMsgType, setSaveMsgType] = useState<'ok' | 'err'>('ok');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load
  useEffect(() => {
    setLoading(true);
    supabase
      .from('hero_slides')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setSlides(data as HeroSlide[]);
        setLoading(false);
      });
  }, []);

  function flash(msg: string, type: 'ok' | 'err' = 'ok') {
    setSaveMsg(msg);
    setSaveMsgType(type);
    setTimeout(() => setSaveMsg(null), 3500);
  }

  async function handleAddSlide() {
    const maxOrder = slides.reduce((m, s) => Math.max(m, s.sort_order), -1);
    const db = adminSupabase();
    const { data, error } = await db
      .from('hero_slides')
      .insert({ ...BLANK_SLIDE, sort_order: maxOrder + 1 })
      .select()
      .maybeSingle();
    if (error || !data) { flash('Failed to add slide', 'err'); return; }
    const newSlide = data as HeroSlide;
    setSlides(prev => [...prev, newSlide]);
    setExpandedId(newSlide.id);
  }

  async function handleDelete(id: string) {
    const db = adminSupabase();
    const { error } = await db.from('hero_slides').delete().eq('id', id);
    if (error) { flash('Failed to delete slide', 'err'); return; }
    setSlides(prev => prev.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
    flash('Slide deleted');
  }

  async function handleSaveSlide(slide: HeroSlide) {
    setSaving(true);
    const db = adminSupabase();
    const { error } = await db
      .from('hero_slides')
      .update({
        image_url: slide.image_url,
        title: slide.title,
        subtitle: slide.subtitle,
        badge: slide.badge,
        button_text: slide.button_text,
        button_url: slide.button_url,
        sort_order: slide.sort_order,
        is_active: slide.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', slide.id);
    setSaving(false);
    if (error) { flash('Failed to save slide', 'err'); return; }
    setSlides(prev => prev.map(s => (s.id === slide.id ? slide : s)));
    flash('Slide saved!');
  }

  async function moveSlide(id: string, dir: 'up' | 'down') {
    const idx = slides.findIndex(s => s.id === id);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;

    const updated = [...slides];
    const tmp = updated[idx].sort_order;
    updated[idx] = { ...updated[idx], sort_order: updated[swapIdx].sort_order };
    updated[swapIdx] = { ...updated[swapIdx], sort_order: tmp };
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setSlides(updated);

    const db = adminSupabase();
    await Promise.all([
      db.from('hero_slides').update({ sort_order: updated[idx].sort_order }).eq('id', updated[idx].id),
      db.from('hero_slides').update({ sort_order: updated[swapIdx].sort_order }).eq('id', updated[swapIdx].id),
    ]);
  }

  if (loading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator color={Colors.neonBlue} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={slidesStyles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Layers size={18} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Hero Slides</Text>
          <View style={slidesStyles.countBadge}>
            <Text style={slidesStyles.countText}>{slides.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={slidesStyles.addBtn} onPress={handleAddSlide} activeOpacity={0.8}>
          <Plus size={14} color={Colors.background} strokeWidth={2.5} />
          <Text style={slidesStyles.addBtnText}>Add Slide</Text>
        </TouchableOpacity>
      </View>

      {saveMsg && (
        <View style={[slidesStyles.toast, saveMsgType === 'err' && slidesStyles.toastErr]}>
          <Text style={[slidesStyles.toastText, saveMsgType === 'err' && slidesStyles.toastTextErr]}>{saveMsg}</Text>
        </View>
      )}

      {slides.length === 0 ? (
        <View style={slidesStyles.empty}>
          <Layers size={32} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={slidesStyles.emptyTitle}>No slides yet</Text>
          <Text style={slidesStyles.emptySubtext}>Add your first hero slide to replace the static banner.</Text>
        </View>
      ) : (
        slides.map((slide, idx) => (
          <SlideCard
            key={slide.id}
            slide={slide}
            index={idx}
            total={slides.length}
            expanded={expandedId === slide.id}
            saving={saving}
            onToggleExpand={() => setExpandedId(expandedId === slide.id ? null : slide.id)}
            onSave={handleSaveSlide}
            onDelete={handleDelete}
            onMoveUp={() => moveSlide(slide.id, 'up')}
            onMoveDown={() => moveSlide(slide.id, 'down')}
          />
        ))
      )}

      <View style={slidesStyles.hint}>
        <Text style={slidesStyles.hintText}>
          When slides exist, they replace the static hero banner. Only active slides are shown to users.
        </Text>
      </View>
    </View>
  );
}

function SlideCard({
  slide, index, total, expanded, saving,
  onToggleExpand, onSave, onDelete, onMoveUp, onMoveDown,
}: {
  slide: HeroSlide; index: number; total: number; expanded: boolean; saving: boolean;
  onToggleExpand: () => void;
  onSave: (s: HeroSlide) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [draft, setDraft] = useState<HeroSlide>(slide);

  useEffect(() => { setDraft(slide); }, [slide]);

  function upd(key: keyof HeroSlide, val: any) {
    setDraft(prev => ({ ...prev, [key]: val }));
  }

  const hasImage = !!draft.image_url;

  return (
    <View style={[slidesStyles.card, !draft.is_active && slidesStyles.cardInactive]}>
      {/* Card header row */}
      <TouchableOpacity style={slidesStyles.cardHeader} onPress={onToggleExpand} activeOpacity={0.8}>
        {hasImage ? (
          <Image source={{ uri: draft.image_url }} style={slidesStyles.thumb} resizeMode="cover" />
        ) : (
          <View style={[slidesStyles.thumb, slidesStyles.thumbEmpty]}>
            <ImageIcon size={14} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={slidesStyles.cardTitle} numberOfLines={1}>
            {draft.title || `Slide ${index + 1}`}
          </Text>
          {draft.badge ? <Text style={slidesStyles.cardBadge}>{draft.badge}</Text> : null}
        </View>
        <View style={slidesStyles.cardMeta}>
          <View style={[slidesStyles.activePill, draft.is_active ? slidesStyles.activePillOn : slidesStyles.activePillOff]}>
            <Text style={[slidesStyles.activePillText, !draft.is_active && { color: Colors.textMuted }]}>
              {draft.is_active ? 'Active' : 'Hidden'}
            </Text>
          </View>
          <View style={slidesStyles.orderBtns}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onMoveUp(); }} disabled={index === 0} activeOpacity={0.7}>
              <ChevronUp size={15} color={index === 0 ? Colors.border : Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onMoveDown(); }} disabled={index === total - 1} activeOpacity={0.7}>
              <ChevronDown size={15} color={index === total - 1 ? Colors.border : Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {expanded
            ? <ChevronUp size={16} color={Colors.neonBlue} strokeWidth={2} />
            : <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} />}
        </View>
      </TouchableOpacity>

      {/* Expanded editor */}
      {expanded && (
        <View style={slidesStyles.editor}>
          <Divider />

          <ImageUploader
            label="Slide Background Image"
            value={draft.image_url}
            onChange={(v) => upd('image_url', v)}
            folder="hero-slides"
            previewHeight={120}
            hint="Upload an image or paste a URL."
            allowUrl
            editorPreset="hero"
          />

          <View style={{ height: Spacing.md }} />

          <ContentField label="Badge Text" value={draft.badge} onChange={(v) => upd('badge', v)} placeholder="NEW ARRIVAL" />
          <ContentField label="Title" value={draft.title} onChange={(v) => upd('title', v)} placeholder="Headline text" />
          <ContentField label="Subtitle" value={draft.subtitle} onChange={(v) => upd('subtitle', v)} placeholder="Supporting description" multiline />

          <Divider />

          <ContentField
            label="Button Text"
            value={draft.button_text}
            onChange={(v) => upd('button_text', v)}
            placeholder="Shop Now"
          />
          <View style={slidesStyles.fieldGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Link size={12} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={slidesStyles.fieldLabel}>Button Link</Text>
            </View>
            <TextInput
              style={slidesStyles.urlInput}
              value={draft.button_url}
              onChangeText={(v) => upd('button_url', v)}
              placeholder="/(tabs)/products  or  https://..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={slidesStyles.urlHint}>Use an app path like /(tabs)/products or a full URL.</Text>
          </View>

          <Divider />

          {/* Active toggle + sort order */}
          <View style={slidesStyles.bottomRow}>
            <TouchableOpacity
              style={slidesStyles.toggleRow}
              onPress={() => upd('is_active', !draft.is_active)}
              activeOpacity={0.8}
            >
              {draft.is_active
                ? <ToggleRight size={22} color={Colors.neonBlue} strokeWidth={2} />
                : <ToggleLeft size={22} color={Colors.textMuted} strokeWidth={2} />}
              <Text style={[slidesStyles.toggleLabel, !draft.is_active && { color: Colors.textMuted }]}>
                {draft.is_active ? 'Slide Active' : 'Slide Hidden'}
              </Text>
            </TouchableOpacity>

            <View style={slidesStyles.sortRow}>
              <Text style={slidesStyles.fieldLabel}>Order</Text>
              <TextInput
                style={slidesStyles.sortInput}
                value={String(draft.sort_order)}
                onChangeText={(v) => upd('sort_order', parseInt(v, 10) || 0)}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          {/* Action buttons */}
          <View style={slidesStyles.actionRow}>
            <TouchableOpacity
              style={slidesStyles.deleteBtn}
              onPress={() => onDelete(draft.id)}
              activeOpacity={0.8}
            >
              <Trash2 size={13} color={Colors.error} strokeWidth={2} />
              <Text style={slidesStyles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[slidesStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => onSave(draft)}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.background} />
                : <><Save size={13} color={Colors.background} strokeWidth={2.5} /><Text style={slidesStyles.saveBtnText}>Save Slide</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const slidesStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  countBadge: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  countText: { color: Colors.neonBlue, fontSize: 10, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },

  toast: {
    backgroundColor: 'rgba(0,191,255,0.10)',
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toastErr: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  toastText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '600' },
  toastTextErr: { color: Colors.error },

  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.xl,
  },
  emptyTitle: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '700' },
  emptySubtext: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardInactive: { opacity: 0.65 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  thumb: {
    width: 52,
    height: 36,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  thumbEmpty: {
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  cardBadge: { color: Colors.neonBlue, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  activePillOn: { backgroundColor: 'rgba(0,230,118,0.10)', borderColor: 'rgba(0,230,118,0.35)' },
  activePillOff: { backgroundColor: Colors.backgroundSecondary, borderColor: Colors.border },
  activePillText: { color: '#00E676', fontSize: 9, fontWeight: '700' },

  orderBtns: { flexDirection: 'row', gap: 2 },

  editor: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },

  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  urlInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  urlHint: { color: Colors.textMuted, fontSize: 10, marginTop: 4, lineHeight: 14 },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    width: 60,
    textAlign: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: Colors.errorDim,
  },
  deleteBtnText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  saveBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },

  hint: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
});

// ─── Hero Editor Section ──────────────────────────────────────────────────────
// Owns its own state — does NOT rely on parent content map for hero fields.
// Loads directly from homepage_content, saves directly to homepage_content,
// then triggers a global CMS refresh so the storefront picks up changes instantly.

function HeroEditorSection({
  language,
  onSaved,
}: {
  language: string;
  onSaved: () => void;
}) {
  const { refresh: refreshCMS } = useCMS();

  // ── Local hero state ──────────────────────────────────────────────────────
  const [fields, setFields] = useState<Record<string, string>>({
    media_type: 'image',
    image_url: '',
    video_url: '',
    badge_text: 'PROFESSIONAL GRADE',
    title: 'Tested in Real Skydives',
    subtitle: 'Gear trusted by 10,000+ skydivers worldwide',
    cta_primary: 'Shop Now',
    cta_secondary: 'View Featured',
    overlay_color: 'rgba(5,10,20,0.55)',
  });
  const [loadingHero, setLoadingHero] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string | null>(null);

  // ── Load from DB whenever language changes ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingHero(true);
    supabase
      .from('homepage_content')
      .select('key, value')
      .eq('section', 'hero')
      .eq('language', language)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[HeroEditor] load error', { message: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint });
          setLoadingHero(false);
          return;
        }
        const loaded: Record<string, string> = {};
        (data ?? []).forEach((r: { key: string; value: string }) => {
          if (r.value !== null && r.value !== undefined) loaded[r.key] = r.value;
        });
        setFields(prev => ({
          media_type: 'image',
          image_url: '',
          video_url: '',
          badge_text: 'PROFESSIONAL GRADE',
          title: 'Tested in Real Skydives',
          subtitle: 'Gear trusted by 10,000+ skydivers worldwide',
          cta_primary: 'Shop Now',
          cta_secondary: 'View Featured',
          overlay_color: 'rgba(5,10,20,0.55)',
          ...loaded,
        }));
        setLoadingHero(false);
      });
    return () => { cancelled = true; };
  }, [language]);

  // ── Derived preview state (no debounce — fields IS the single source of truth) ──
  const preview: HeroPreviewState = {
    mediaType: (fields.media_type ?? 'image') as 'image' | 'video',
    imageUrl: fields.image_url ?? '',
    videoUrl: fields.video_url ?? '',
    overlayOpacity: parseOverlayOpacity(fields.overlay_color ?? 'rgba(0,0,0,0.55)'),
    badgeText: fields.badge_text ?? 'PROFESSIONAL GRADE',
    title: fields.title ?? 'Tested in Real Skydives',
    subtitle: fields.subtitle ?? '',
    ctaPrimary: fields.cta_primary ?? 'Shop Now',
  };

  function parseOverlayOpacity(overlayColor: string): number {
    const m = overlayColor.match(/rgba?\([^)]*,\s*([\d.]+)\)/);
    if (m) return Math.min(1, Math.max(0, parseFloat(m[1])));
    return 0.55;
  }

  function set(key: string, value: string) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  function setOverlay(opacity: number) {
    set('overlay_color', `rgba(0,0,0,${opacity.toFixed(2)})`);
  }

  // ── Save directly to homepage_content ────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    // Ensure both media fields are always written, even if empty
    const payload = {
      media_type:    fields.media_type    ?? 'image',
      image_url:     fields.image_url     ?? '',
      video_url:     fields.video_url     ?? '',
      badge_text:    fields.badge_text    ?? '',
      title:         fields.title         ?? '',
      subtitle:      fields.subtitle      ?? '',
      cta_primary:   fields.cta_primary   ?? '',
      cta_secondary: fields.cta_secondary ?? '',
      overlay_color: fields.overlay_color ?? 'rgba(5,10,20,0.55)',
    };

    const db = adminSupabase();
    const results = await Promise.all(
      Object.entries(payload).map(([key, value]) =>
        db.from('homepage_content').upsert(
          { section: 'hero', key, value, language, updated_at: new Date().toISOString() },
          { onConflict: 'section,key,language' }
        )
      )
    );

    const firstError = results.find(r => r.error);
    if (firstError?.error) {
      const e = firstError.error;
      console.error('[HeroEditor] save failed', { message: e.message, code: (e as any).code, details: (e as any).details, hint: (e as any).hint });
      setSaveError(`Save failed: ${e.message}${(e as any).hint ? ` — ${(e as any).hint}` : ''}`);
      setSaving(false);
      return;
    }

    // Auto-seed all other languages that have no hero content yet (use English as fallback)
    if (language === 'en') {
      const allLangs = ['ar', 'es', 'de', 'ru'];
      for (const lang of allLangs) {
        const { data: existing } = await supabase
          .from('homepage_content')
          .select('key')
          .eq('section', 'hero')
          .eq('language', lang)
          .limit(1);
        if (!existing || existing.length === 0) {
          await Promise.all(
            Object.entries(payload).map(([key, value]) =>
              db.from('homepage_content').upsert(
                { section: 'hero', key, value, language: lang, updated_at: new Date().toISOString() },
                { onConflict: 'section,key,language' }
              )
            )
          );
        }
      }
    }

    // Refresh global CMS so storefront re-reads the saved data immediately
    await refreshCMS(language);
    onSaved();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setFields({
      media_type: 'image',
      image_url: 'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800',
      video_url: '',
      badge_text: 'PROFESSIONAL GRADE',
      title: 'Tested in Real Skydives',
      subtitle: 'Gear trusted by 10,000+ skydivers worldwide',
      cta_primary: 'Shop Now',
      cta_secondary: 'View Featured',
      overlay_color: 'rgba(5,10,20,0.55)',
    });
  }

  async function handleAutoTranslate() {
    if (!fields.title?.trim()) { setTranslateMsg('Enter a title first'); return; }
    setTranslating(true);
    setTranslateMsg(null);
    try {
      const textsToTranslate: Record<string, string> = {};
      if (fields.title?.trim()) textsToTranslate.title = fields.title.trim();
      if (fields.subtitle?.trim()) textsToTranslate.subtitle = fields.subtitle.trim();
      if (fields.badge_text?.trim()) textsToTranslate.badge_text = fields.badge_text.trim();
      if (fields.cta_primary?.trim()) textsToTranslate.cta_primary = fields.cta_primary.trim();
      if (fields.cta_secondary?.trim()) textsToTranslate.cta_secondary = fields.cta_secondary.trim();

      const result = await autoTranslate(textsToTranslate);
      const db = adminSupabase();
      const targetLangs = ['ar', 'es', 'de', 'ru'];

      for (const lang of targetLangs) {
        const langResult = result[lang];
        if (!langResult) continue;
        const entries = Object.entries(langResult).filter(([, v]) => v?.trim());
        await Promise.all(
          entries.map(([key, value]) =>
            db.from('homepage_content').upsert(
              { section: 'hero', key, value, language: lang, updated_at: new Date().toISOString() },
              { onConflict: 'section,key,language' }
            )
          )
        );
        // Copy non-text fields (image, video, overlay) as-is
        const nonTextFields = ['media_type', 'image_url', 'video_url', 'overlay_color'];
        await Promise.all(
          nonTextFields
            .filter(k => fields[k] !== undefined)
            .map(k =>
              db.from('homepage_content').upsert(
                { section: 'hero', key: k, value: fields[k] ?? '', language: lang, updated_at: new Date().toISOString() },
                { onConflict: 'section,key,language' }
              )
            )
        );
      }

      await refreshCMS('en');
      setTranslateMsg('All languages translated and saved!');
      setTimeout(() => setTranslateMsg(null), 4000);
    } catch (err) {
      setTranslateMsg('Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  }

  if (loadingHero) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator color={Colors.neonBlue} />
      </View>
    );
  }

  return (
    <View>
      <HeroLivePreview state={preview} />

      <View style={styles.section}>
        {/* Actions row */}
        <View style={heroStyles.sectionActions}>
          <View style={styles.sectionTitleRow}>
            <ImageIcon size={18} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.sectionTitle}>Hero Banner</Text>
          </View>
          <View style={heroStyles.actionBtns}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
              <RotateCcw size={12} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            {language === 'en' && (
              <TouchableOpacity
                style={[heroStyles.translateBtn, (translating || saving) && { opacity: 0.6 }]}
                onPress={handleAutoTranslate}
                disabled={translating || saving}
                activeOpacity={0.8}
              >
                {translating
                  ? <ActivityIndicator color={Colors.neonBlue} size="small" />
                  : <><Globe size={13} color={Colors.neonBlue} strokeWidth={2} /><Text style={heroStyles.translateBtnText}>Auto-Translate All</Text></>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={Colors.background} size="small" />
              ) : saved ? (
                <>
                  <CheckCircle size={13} color={Colors.background} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Saved!</Text>
                </>
              ) : (
                <>
                  <Save size={13} color={Colors.background} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {saveError && (
          <View style={heroStyles.errorBox}>
            <Text style={heroStyles.errorText}>Save failed: {saveError}</Text>
          </View>
        )}
        {translateMsg && (
          <View style={[heroStyles.errorBox, { borderColor: Colors.neonBlueBorder, backgroundColor: Colors.neonBlueGlow }]}>
            <Text style={[heroStyles.errorText, { color: Colors.neonBlue }]}>{translateMsg}</Text>
          </View>
        )}

        {/* Media type toggle */}
        <View style={heroStyles.mediaToggle}>
          <Text style={heroStyles.mediaToggleLabel}>Media Type</Text>
          <View style={heroStyles.mediaToggleBtns}>
            {(['image', 'video'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[heroStyles.mediaBtn, fields.media_type === type && heroStyles.mediaBtnActive]}
                onPress={() => set('media_type', type)}
                activeOpacity={0.8}
              >
                {type === 'image'
                  ? <ImageIcon size={13} color={fields.media_type === type ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                  : <Video size={13} color={fields.media_type === type ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                <Text style={[heroStyles.mediaBtnText, fields.media_type === type && heroStyles.mediaBtnTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Divider />

        {/* Media inputs */}
        {fields.media_type === 'video' ? (
          <>
            <View style={heroStyles.videoField}>
              <Text style={heroStyles.videoLabel}>Video URL</Text>
              <Text style={heroStyles.videoHint}>Direct MP4 or WebM URL. Autoplays muted on the homepage.</Text>
              <TextInput
                style={heroStyles.videoInput}
                value={fields.video_url}
                onChangeText={(v) => set('video_url', v)}
                placeholder="https://example.com/video.mp4"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={{ height: 8 }} />
            <ImageUploader
              label="Fallback Image (shown if video fails or on mobile)"
              value={fields.image_url}
              onChange={(v) => set('image_url', v)}
              folder="cms"
              previewHeight={100}
              hint="Required — shown when autoplay is blocked."
              allowUrl
              editorPreset="hero"
            />
          </>
        ) : (
          <ImageUploader
            label="Background Image"
            value={fields.image_url}
            onChange={(v) => set('image_url', v)}
            folder="cms"
            previewHeight={130}
            hint="Upload or paste a URL."
            allowUrl
            editorPreset="hero"
          />
        )}

        <Divider />

        {/* Overlay */}
        <View style={heroStyles.overlayRow}>
          <View style={heroStyles.overlayLabelRow}>
            <SlidersHorizontal size={14} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={heroStyles.overlayLabel}>Overlay Darkness</Text>
            <View style={[heroStyles.overlayChip, { backgroundColor: `rgba(0,0,0,${preview.overlayOpacity.toFixed(2)})`, borderColor: Colors.border }]}>
              <Text style={heroStyles.overlayChipText}>{Math.round(preview.overlayOpacity * 100)}%</Text>
            </View>
          </View>
          <OverlaySlider value={preview.overlayOpacity} onChange={setOverlay} />
        </View>

        <Divider />

        {/* Text fields */}
        <SectionHeader icon={<Type size={16} color={Colors.neonBlue} strokeWidth={2} />} title="Text Content" />
        <ContentField label="Badge Text" value={fields.badge_text} onChange={(v) => set('badge_text', v)} placeholder="PROFESSIONAL GRADE" rtl={language === 'ar'} />
        <ContentField label="Hero Title" value={fields.title} onChange={(v) => set('title', v)} placeholder="Tested in Real Skydives" multiline rtl={language === 'ar'} />
        <ContentField label="Hero Subtitle" value={fields.subtitle} onChange={(v) => set('subtitle', v)} placeholder="Gear trusted by 10,000+ skydivers worldwide" multiline rtl={language === 'ar'} />

        <Divider />

        <SectionHeader icon={<MousePointerClick size={16} color={Colors.neonBlue} strokeWidth={2} />} title="Buttons" />
        <ContentField label="Primary Button" value={fields.cta_primary} onChange={(v) => set('cta_primary', v)} placeholder="Shop Now" rtl={language === 'ar'} />
        <ContentField label="Secondary Button" value={fields.cta_secondary} onChange={(v) => set('cta_secondary', v)} placeholder="View Featured" rtl={language === 'ar'} />
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  sectionActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg, flexWrap: 'wrap', gap: 8 },
  actionBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  errorBox: { backgroundColor: Colors.errorDim, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { color: Colors.error, fontSize: FontSize.sm },

  mediaToggle: { marginBottom: Spacing.md },
  mediaToggleLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  mediaToggleBtns: { flexDirection: 'row', gap: 8 },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  mediaBtnActive: { borderColor: Colors.neonBlue, backgroundColor: 'rgba(0,191,255,0.1)' },
  mediaBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  mediaBtnTextActive: { color: Colors.neonBlue },

  videoField: { marginBottom: Spacing.sm },
  videoLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  videoHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 6, lineHeight: 16 },
  videoInput: { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.sm },

  overlayRow: { marginBottom: Spacing.md },
  overlayLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  overlayLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  overlayChip: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  overlayChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  translateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.neonBlueBorder, backgroundColor: Colors.neonBlueGlow },
  translateBtnText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },
});

function ContentScreen() {
  const { isMobile } = useAdminLayout();
  const { isAdminAuthenticated } = useAdmin();
  const router = useRouter();
  const { refresh: refreshCMS } = useCMS();
  const { t } = useLanguage();
  const TABS = [
    { id: 'branding' as Tab, label: t.tabBranding },
    { id: 'hero' as Tab, label: t.tabHero },
    { id: 'slides' as Tab, label: 'Slides' },
    { id: 'featured' as Tab, label: t.tabFeatured },
    { id: 'canopy' as Tab, label: t.tabCanopy },
    { id: 'testimonials' as Tab, label: t.tabTestimonials },
    { id: 'footer' as Tab, label: t.tabFooter },
  ];
  const [language, setLanguage] = useState('en');
  const [content, setContent] = useState<CMSContent>({});
  const [branding, setBranding] = useState<BrandingMap>({ ...DEFAULT_BRANDING });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('branding');
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchAll(language);
  }, [isAdminAuthenticated]);

  const fetchAll = useCallback(async (lang: string) => {
    setLoading(true);
    const [contentRes, brandingRes] = await Promise.all([
      supabase.from('homepage_content').select('section, key, value').eq('language', lang),
      supabase.from('site_branding').select('key, value'),
    ]);

    const map: CMSContent = {};
    (contentRes.data ?? []).forEach((row: any) => {
      if (!map[row.section]) map[row.section] = {};
      map[row.section][row.key] = row.value;
    });
    setContent(map);

    const bmap: BrandingMap = { ...DEFAULT_BRANDING };
    (brandingRes.data ?? []).forEach((row: any) => { bmap[row.key] = row.value; });
    setBranding(bmap);
    setLoading(false);
  }, []);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    fetchAll(lang);
  };

  const updateField = useCallback((section: string, key: string, value: string) => {
    setContent((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  const updateBranding = useCallback((key: string, value: string) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const contentRows: { section: string; key: string; value: string; language: string }[] = [];
    Object.entries(content).forEach(([section, keys]) => {
      Object.entries(keys).forEach(([key, value]) => {
        contentRows.push({ section, key, value, language });
      });
    });

    const brandingRows = Object.entries(branding).map(([key, value]) => ({ key, value }));

    const db = adminSupabase();
    const results = await Promise.all([
      ...contentRows.map((row) =>
        db.from('homepage_content').upsert(
          { section: row.section, key: row.key, value: row.value, language: row.language, updated_at: new Date().toISOString() },
          { onConflict: 'section,key,language' }
        )
      ),
      ...brandingRows.map((row) =>
        db.from('site_branding').upsert(
          { key: row.key, value: row.value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      ),
    ]);

    const firstErr = results.find(r => r.error);
    if (firstErr?.error) {
      const e = firstErr.error;
      console.error('[ContentSave] failed', { message: e.message, code: (e as any).code, details: (e as any).details, hint: (e as any).hint });
      setSaveError(`Save failed: ${e.message}${(e as any).hint ? ` — ${(e as any).hint}` : ''}`);
      setSaving(false);
      return;
    }

    // Refresh global CMS context after save so storefront picks up changes
    await refreshCMS(language);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setContent(DEFAULT_CONTENT_EN);
    setBranding({ ...DEFAULT_BRANDING });
  };

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.cmsContentTitle} showBack>
        <MobileUnsupported featureName="CMS Content Editor" />
      </AdminMobileDashboard>
    );
  }

  if (loading) {
    return (
      <AdminWebDashboard title={t.siteEditor}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
          <Text style={styles.loadingText}>{t.loadingContent}</Text>
        </View>
      </AdminWebDashboard>
    );
  }

  const hero = content.hero ?? {
    media_type: 'image',
    image_url: '',
    video_url: '',
    badge_text: '',
    title: '',
    subtitle: '',
    cta_primary: '',
    overlay_color: 'rgba(5,10,20,0.55)',
  };
  const featured = content.featured ?? {};
  const canopy = content.canopy ?? {};
  const testimonials = content.testimonials ?? {};
  const footer = content.footer ?? {};

  const editorPanel = (
    <View style={[styles.editorPanel, IS_WIDE && styles.editorPanelWide]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Layout size={16} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.topBarTitle}>{t.contentManager}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.previewToggleBtn} onPress={() => setShowPreview(v => !v)} activeOpacity={0.8}>
            {showPreview
              ? <EyeOff size={14} color={Colors.textMuted} strokeWidth={2} />
              : <Eye size={14} color={Colors.textMuted} strokeWidth={2} />}
            <Text style={styles.previewToggleText}>{showPreview ? t.hidePreview : t.showPreview}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <RotateCcw size={13} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.resetBtnText}>{t.resetSection}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : saved ? (
              <>
                <CheckCircle size={14} color={Colors.background} strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>{t.savedBang}</Text>
              </>
            ) : (
              <>
                <Save size={14} color={Colors.background} strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>{t.save}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {saveError && (
        <View style={heroStyles.errorBox}>
          <Text style={heroStyles.errorText}>{saveError}</Text>
        </View>
      )}

      {/* Language selector */}
      <View style={styles.langBar}>
        <Globe size={14} color={Colors.textMuted} strokeWidth={2} />
        <Text style={styles.langBarLabel}>{t.languageLabel}</Text>
        <View style={styles.langPills}>
          {LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langPill, language === l.code && styles.langPillActive]}
              onPress={() => handleLanguageChange(l.code)}
              activeOpacity={0.8}
            >
              <Text style={[styles.langPillText, language === l.code && styles.langPillTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* === BRANDING === */}
      {activeTab === 'branding' && (
        <View style={styles.section}>
          <SectionHeader icon={<Layout size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.logoBranding} />

          <ImageUploader
            label={t.logoImage}
            value={branding.logo_url}
            onChange={(v) => updateBranding('logo_url', v)}
            folder="branding"
            previewHeight={80}
            hint={t.logoImageHint}
            containMode
            allowUrl
            editorPreset="logo"
          />

          <Divider />
          <SectionHeader icon={<Type size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.appIdentity} />
          <ContentField label={t.appName} value={branding.app_name} onChange={(v) => updateBranding('app_name', v)} placeholder="SKYDIVER" />
          <ContentField label={t.appTagline} value={branding.app_tagline} onChange={(v) => updateBranding('app_tagline', v)} placeholder="MAN GEAR" hint={t.appTaglineHint} />
          <ToggleField
            label={t.showHeaderIcons}
            value={branding.header_icons === 'true'}
            onToggle={() => updateBranding('header_icons', branding.header_icons === 'true' ? 'false' : 'true')}
          />
        </View>
      )}

      {/* === HERO === */}
      {activeTab === 'hero' && (
        <HeroEditorSection
          language={language}
          onSaved={() => {}}
        />
      )}

      {/* === SLIDES === */}
      {activeTab === 'slides' && (
        <HeroSlidesEditorSection />
      )}

      {/* === FEATURED === */}
      {activeTab === 'featured' && (
        <View style={styles.section}>
          <SectionHeader icon={<Star size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.featuredProductsSection} />
          <ContentField label={t.sectionTitle} value={featured.title ?? ''} onChange={(v) => updateField('featured', 'title', v)} placeholder="Featured Gear" rtl={language === 'ar'} />
          <ContentField label={t.sectionSubtitle} value={featured.subtitle ?? ''} onChange={(v) => updateField('featured', 'subtitle', v)} placeholder="Hand-picked by our experts" rtl={language === 'ar'} />
          <ToggleField
            label={t.showFeaturedSection}
            value={featured.enabled !== 'false'}
            onToggle={() => updateField('featured', 'enabled', featured.enabled === 'false' ? 'true' : 'false')}
          />
          <InfoBox text="To mark products as featured, go to the Products module and toggle 'Mark as Featured' on the product." />
        </View>
      )}

      {/* === CANOPY === */}
      {activeTab === 'canopy' && (
        <View style={styles.section}>
          <SectionHeader icon={<Wind size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.canopyFinderSection} />
          <ContentField label={t.sectionTitle} value={canopy.title ?? ''} onChange={(v) => updateField('canopy', 'title', v)} placeholder="Find Your Canopy" rtl={language === 'ar'} />
          <ContentField label={t.canopyDescription} value={canopy.subtitle ?? ''} onChange={(v) => updateField('canopy', 'subtitle', v)} placeholder="Use our expert tool..." multiline rtl={language === 'ar'} />
          <ContentField label={t.ctaButtonText} value={canopy.cta_text ?? ''} onChange={(v) => updateField('canopy', 'cta_text', v)} placeholder="Use Canopy Advisor" rtl={language === 'ar'} />
          <ToggleField
            label={t.showCanopySection}
            value={canopy.enabled !== 'false'}
            onToggle={() => updateField('canopy', 'enabled', canopy.enabled === 'false' ? 'true' : 'false')}
          />
        </View>
      )}

      {/* === TESTIMONIALS === */}
      {activeTab === 'testimonials' && (
        <View style={styles.section}>
          <SectionHeader icon={<MessageSquare size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.testimonialsSection} />
          <ContentField label={t.sectionTitle} value={testimonials.title ?? ''} onChange={(v) => updateField('testimonials', 'title', v)} placeholder="Trusted by Skydivers" rtl={language === 'ar'} />
          <ContentField label={t.sectionSubtitle} value={testimonials.subtitle ?? ''} onChange={(v) => updateField('testimonials', 'subtitle', v)} placeholder="Hear from our community" multiline rtl={language === 'ar'} />
          <ToggleField
            label={t.showTestimonialsSection}
            value={testimonials.enabled !== 'false'}
            onToggle={() => updateField('testimonials', 'enabled', testimonials.enabled === 'false' ? 'true' : 'false')}
          />
          <InfoBox text="Testimonials are pulled from approved reviews. Manage reviews in the Reviews module." />
        </View>
      )}

      {/* === FOOTER === */}
      {activeTab === 'footer' && (
        <View style={styles.section}>
          <SectionHeader icon={<Type size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.footerContent} />
          <ContentField label={t.tagline} value={footer.tagline ?? ''} onChange={(v) => updateField('footer', 'tagline', v)} placeholder="Professional skydiving equipment trusted worldwide." multiline rtl={language === 'ar'} />
          <ContentField label={t.copyrightText} value={footer.copyright ?? ''} onChange={(v) => updateField('footer', 'copyright', v)} placeholder="© 2026 Skydiver Man Gear." rtl={language === 'ar'} />
          <ContentField label={t.contactEmail} value={footer.contact_email ?? ''} onChange={(v) => updateField('footer', 'contact_email', v)} placeholder="support@example.com" />
          <ContentField label={t.contactPhone} value={footer.contact_phone ?? ''} onChange={(v) => updateField('footer', 'contact_phone', v)} placeholder="+1 (800) 555-0199" />
          <ImageUploader
            label={t.footerLogoOptional}
            value={footer.logo_url ?? ''}
            onChange={(v) => updateField('footer', 'logo_url', v)}
            folder="branding"
            previewHeight={70}
            hint={t.footerLogoHint}
            containMode
            allowUrl
            editorPreset="logo"
          />
          <Divider />
          <SectionHeader icon={<Globe size={18} color={Colors.neonBlue} strokeWidth={2} />} title={t.navigationColumns} />
          <ContentField label={t.column1Title} value={footer.col1_title ?? ''} onChange={(v) => updateField('footer', 'col1_title', v)} placeholder="Shop" rtl={language === 'ar'} />
          <ContentField label={t.column2Title} value={footer.col2_title ?? ''} onChange={(v) => updateField('footer', 'col2_title', v)} placeholder="Company" rtl={language === 'ar'} />
          <ContentField label={t.column3Title} value={footer.col3_title ?? ''} onChange={(v) => updateField('footer', 'col3_title', v)} placeholder="Support" rtl={language === 'ar'} />
        </View>
      )}
    </View>
  );

  const previewPanel = showPreview ? (
    <View style={[styles.previewPanel, IS_WIDE && styles.previewPanelWide]}>
      <View style={styles.previewHeader}>
        <Smartphone size={14} color={Colors.neonBlue} strokeWidth={2} />
        <Text style={styles.previewHeaderText}>{t.livePreview}</Text>
        <View style={styles.previewLiveDot} />
        <Text style={styles.previewLiveLabel}>{t.live}</Text>
      </View>
      <View style={styles.phoneFrame}>
        <View style={styles.phoneNotch} />
        <ScrollView style={styles.phoneScreen} showsVerticalScrollIndicator={false}>
          {activeTab === 'branding' && <BrandingPreview branding={branding} />}
          {activeTab === 'hero' && <HeroPreview hero={hero} />}
          {activeTab === 'featured' && <FeaturedPreview featured={featured} />}
          {activeTab === 'canopy' && <CanopyPreview canopy={canopy} />}
          {activeTab === 'testimonials' && <TestimonialsPreview testimonials={testimonials} />}
          {activeTab === 'footer' && <FooterPreview footer={footer} branding={branding} />}
        </ScrollView>
      </View>
    </View>
  ) : null;

  return (
    <AdminWebDashboard title={t.siteEditor}>
      {IS_WIDE ? (
        <View style={styles.wideLayout}>
          <ScrollView style={styles.editorScroll} showsVerticalScrollIndicator={false}>
            {editorPanel}
          </ScrollView>
          {previewPanel}
        </View>
      ) : (
        <View style={styles.narrowLayout}>
          {editorPanel}
          {previewPanel}
        </View>
      )}
    </AdminWebDashboard>
  );
}

export default function ContentScreenGuarded() {
  return (
    <AdminGuard permission="manage_cms">
      <ContentScreen />
    </AdminGuard>
  );
}

// ─── Preview Components ──────────────────────────────────────────────────────

function BrandingPreview({ branding }: { branding: BrandingMap }) {
  return (
    <View>
      <View style={pv.header}>
        <View style={pv.menuBtn} />
        <View style={pv.headerCenter}>
          {branding.logo_url ? (
            <Image source={{ uri: branding.logo_url }} style={pv.logoImg} resizeMode="contain" />
          ) : (
            <View style={{ flexDirection: 'row' }}>
              <Text style={pv.logoText}>{branding.app_name || 'SKYDIVER'}</Text>
              <Text style={pv.logoAccent}> {branding.app_tagline || 'MAN GEAR'}</Text>
            </View>
          )}
        </View>
        {branding.header_icons !== 'false' && (
          <View style={pv.headerIcons}>
            <View style={pv.iconDot} />
            <View style={pv.iconDot} />
          </View>
        )}
      </View>
      <View style={pv.heroBg}>
        <Text style={pv.heroPlaceholder}>Hero Banner</Text>
      </View>
      <View style={pv.body}>
        <Text style={pv.bodyMuted}>Your logo and app name appear in the header above.</Text>
      </View>
    </View>
  );
}

function HeroPreview({ hero }: { hero: Record<string, string> }) {
  const [imgErr, setImgErr] = useState(false);
  const imageUrl = hero.image_url || '';
  const overlay = hero.overlay_color || 'rgba(5,10,20,0.55)';

  return (
    <View>
      <View style={pv.heroWrap}>
        {imageUrl && !imgErr ? (
          <Image
            source={{ uri: imageUrl }}
            style={pv.heroImg}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[pv.heroImg, pv.heroImgPlaceholder]}>
            <ImageIcon size={24} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={pv.heroImgPlaceholderText}>{imgErr ? 'Image failed to load' : 'No image URL'}</Text>
          </View>
        )}
        <View style={[pv.heroOverlay, { backgroundColor: overlay }]} />
        <View style={pv.heroContent}>
          {hero.badge_text ? (
            <View style={pv.badge}>
              <Text style={pv.badgeText}>{hero.badge_text}</Text>
            </View>
          ) : null}
          <Text style={pv.heroTitle}>{hero.title || 'Hero Title'}</Text>
          <Text style={pv.heroSubtitle}>{hero.subtitle || 'Hero subtitle text here'}</Text>
          {hero.cta_primary ? (
            <View style={pv.ctaBtn}>
              <Text style={pv.ctaBtnText}>{hero.cta_primary}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function FeaturedPreview({ featured }: { featured: Record<string, string> }) {
  if (featured.enabled === 'false') {
    return (
      <View style={pv.hiddenSection}>
        <EyeOff size={20} color={Colors.textMuted} strokeWidth={1.5} />
        <Text style={pv.hiddenText}>Featured Section is hidden</Text>
      </View>
    );
  }
  return (
    <View style={pv.body}>
      <Text style={pv.sectionTitle}>{featured.title || 'Featured Gear'}</Text>
      {featured.subtitle ? <Text style={pv.sectionSubtitle}>{featured.subtitle}</Text> : null}
      <View style={pv.productGrid}>
        {[1, 2, 3, 4].map(i => <View key={i} style={pv.productCard} />)}
      </View>
    </View>
  );
}

function CanopyPreview({ canopy }: { canopy: Record<string, string> }) {
  if (canopy.enabled === 'false') {
    return (
      <View style={pv.hiddenSection}>
        <EyeOff size={20} color={Colors.textMuted} strokeWidth={1.5} />
        <Text style={pv.hiddenText}>Canopy Section is hidden</Text>
      </View>
    );
  }
  return (
    <View style={pv.canopyWrap}>
      <Wind size={24} color={Colors.neonBlue} strokeWidth={2} />
      <Text style={pv.sectionTitle}>{canopy.title || 'Find Your Canopy'}</Text>
      {canopy.subtitle ? <Text style={pv.sectionSubtitle}>{canopy.subtitle}</Text> : null}
      {canopy.cta_text ? (
        <View style={pv.ctaBtn}>
          <Text style={pv.ctaBtnText}>{canopy.cta_text}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TestimonialsPreview({ testimonials }: { testimonials: Record<string, string> }) {
  if (testimonials.enabled === 'false') {
    return (
      <View style={pv.hiddenSection}>
        <EyeOff size={20} color={Colors.textMuted} strokeWidth={1.5} />
        <Text style={pv.hiddenText}>Testimonials Section is hidden</Text>
      </View>
    );
  }
  return (
    <View style={pv.body}>
      <Text style={pv.sectionTitle}>{testimonials.title || 'Trusted by Skydivers'}</Text>
      {testimonials.subtitle ? <Text style={pv.sectionSubtitle}>{testimonials.subtitle}</Text> : null}
      <View style={pv.testimonialsRow}>
        {[1, 2].map(i => (
          <View key={i} style={pv.testimonialCard}>
            <View style={pv.starRow}>
              {[1,2,3,4,5].map(s => <Text key={s} style={pv.star}>★</Text>)}
            </View>
            <Text style={pv.testimonialText}>Great product!</Text>
            <Text style={pv.testimonialAuthor}>— Customer</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FooterPreview({ footer, branding }: { footer: Record<string, string>; branding: BrandingMap }) {
  const logoUrl = footer.logo_url || branding.logo_url;
  return (
    <View style={pv.footerWrap}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={pv.footerLogo} resizeMode="contain" />
      ) : (
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={pv.logoText}>{branding.app_name || 'SKYDIVER'}</Text>
          <Text style={pv.logoAccent}> {branding.app_tagline || 'MAN GEAR'}</Text>
        </View>
      )}
      {footer.tagline ? <Text style={pv.footerTagline}>{footer.tagline}</Text> : null}
      <View style={pv.footerCols}>
        <Text style={pv.footerColTitle}>{footer.col1_title || 'Shop'}</Text>
        <Text style={pv.footerColTitle}>{footer.col2_title || 'Company'}</Text>
        <Text style={pv.footerColTitle}>{footer.col3_title || 'Support'}</Text>
      </View>
      {footer.contact_email ? <Text style={pv.footerContact}>{footer.contact_email}</Text> : null}
      {footer.contact_phone ? <Text style={pv.footerContact}>{footer.contact_phone}</Text> : null}
      {footer.copyright ? <Text style={pv.footerCopyright}>{footer.copyright}</Text> : null}
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Divider() { return <View style={styles.divider} />; }

function InfoBox({ text }: { text: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoBoxText}>{text}</Text>
    </View>
  );
}

function ToggleField({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: Colors.neonBlue, false: Colors.border }} thumbColor={Colors.white} />
    </View>
  );
}


function ContentField({
  label, value, onChange, placeholder, multiline, hint, rtl,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; hint?: string; rtl?: boolean;
}) {
  return (
    <View style={cfStyles.wrapper}>
      <Text style={cfStyles.label}>{label}</Text>
      {hint && <Text style={cfStyles.hint}>{hint}</Text>}
      <TextInput
        style={[cfStyles.input, multiline && { height: 72, textAlignVertical: 'top' }, rtl && { textAlign: 'right' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cfStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 6, lineHeight: 16 },
  input: { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.md },
});


const pv = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8 },
  menuBtn: { width: 18, height: 12, borderRadius: 2, backgroundColor: Colors.border },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  logoText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  logoAccent: { color: Colors.neonBlue, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  logoImg: { height: 20, width: 80 },
  headerIcons: { flexDirection: 'row', gap: 6 },
  iconDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.border },

  heroBg: { height: 80, backgroundColor: Colors.backgroundCard, justifyContent: 'center', alignItems: 'center' },
  heroPlaceholder: { color: Colors.textMuted, fontSize: FontSize.xs },

  heroWrap: { height: 160, position: 'relative', overflow: 'hidden', backgroundColor: Colors.backgroundSecondary },
  heroImg: { position: 'absolute', width: '100%', height: '100%' },
  heroImgPlaceholder: { justifyContent: 'center', alignItems: 'center', gap: 4 },
  heroImgPlaceholderText: { color: Colors.textMuted, fontSize: 10 },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: 'absolute', bottom: 12, left: 10, right: 10 },
  badge: { backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  badgeText: { color: Colors.neonBlue, fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: Colors.white, fontSize: 14, fontWeight: '900', marginBottom: 3 },
  heroSubtitle: { color: Colors.textSecondary, fontSize: 9, marginBottom: 8 },
  ctaBtn: { backgroundColor: Colors.neonBlue, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  ctaBtnText: { color: Colors.background, fontSize: 9, fontWeight: '800' },

  body: { padding: 12 },
  bodyMuted: { color: Colors.textMuted, fontSize: 10, lineHeight: 16 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 9, marginBottom: 10 },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  productCard: { width: '47%', height: 80, backgroundColor: Colors.backgroundCard, borderRadius: Radius.sm },

  canopyWrap: { padding: 12, alignItems: 'center', gap: 6 },

  hiddenSection: { padding: 20, alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundSecondary },
  hiddenText: { color: Colors.textMuted, fontSize: 11 },

  testimonialsRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  testimonialCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: Radius.sm, padding: 8 },
  starRow: { flexDirection: 'row', marginBottom: 4 },
  star: { color: Colors.gold, fontSize: 9 },
  testimonialText: { color: Colors.textSecondary, fontSize: 8, marginBottom: 4 },
  testimonialAuthor: { color: Colors.textMuted, fontSize: 8 },

  footerWrap: { backgroundColor: Colors.backgroundCard, padding: 12 },
  footerLogo: { height: 20, width: 80, marginBottom: 6 },
  footerTagline: { color: Colors.textMuted, fontSize: 9, marginBottom: 10 },
  footerCols: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  footerColTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '700' },
  footerContact: { color: Colors.textMuted, fontSize: 8, marginBottom: 2 },
  footerCopyright: { color: Colors.textMuted, fontSize: 8, marginTop: 8, textAlign: 'center' },
});

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },

  wideLayout: { flexDirection: 'row', flex: 1, gap: Spacing.lg },
  narrowLayout: { flex: 1 },

  editorPanel: { paddingBottom: 80 },
  editorPanelWide: { flex: 1 },
  editorScroll: { flex: 1 },

  previewPanel: { marginTop: Spacing.xl },
  previewPanelWide: { width: 260, marginTop: 0 },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  previewHeaderText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  previewLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  previewLiveLabel: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '700' },

  phoneFrame: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    maxHeight: 520,
  },
  phoneNotch: {
    width: 60,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: 8,
  },
  phoneScreen: { flex: 1 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm, flexWrap: 'wrap' },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  previewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  previewToggleText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  resetBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  saveBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },

  langBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
  langBarLabel: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  langPills: { flexDirection: 'row', gap: 6 },
  langPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  langPillActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlue },
  langPillText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  langPillTextActive: { color: Colors.neonBlue },

  tabsScroll: { marginBottom: Spacing.lg },
  tabs: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.md },
  tab: { paddingHorizontal: Spacing.md, paddingVertical: 9, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlue },
  tabText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  tabTextActive: { color: Colors.neonBlue },

  section: { backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  subsectionLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  toggleLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600', flex: 1 },

  infoBox: { backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  infoBoxText: { color: Colors.neonBlue, fontSize: FontSize.sm, lineHeight: 20 },
});
