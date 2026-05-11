import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  Search,
  Package,
  CircleAlert as AlertCircle,
  Globe,
  CircleCheck as CheckCircle,
  RefreshCw,
  Palette,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import ImageUploader from '@/components/admin/ImageUploader';
import ProductImageGallery, { GalleryImage } from '@/components/admin/ProductImageGallery';
import { supabase, adminSupabase, Product, getProductName } from '@/lib/supabase';
import { autoTranslate } from '@/lib/translate';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { logAudit } from '@/lib/audit';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

const CATEGORIES = ['helmets', 'suits', 'parachutes', 'accessories', 'safety', 'instruments'];

type LangCode = 'en' | 'ar' | 'es' | 'de' | 'ru';

type ColorVariantForm = {
  id?: string;
  name: string;
  hex: string;
  image_url: string;
  is_default: boolean;
  stock: string;
};

const COLOR_NAME_MAP: Record<string, string> = {
  // English
  red: '#FF0000', blue: '#0000FF', black: '#000000', white: '#FFFFFF',
  yellow: '#FFFF00', green: '#008000', pink: '#FFC0CB', purple: '#800080',
  orange: '#FFA500', gray: '#808080', grey: '#808080', brown: '#A52A2A',
  navy: '#001F5B', silver: '#C0C0C0', gold: '#FFD700', beige: '#F5F5DC',
  cyan: '#00BFFF', teal: '#008080', maroon: '#800000', olive: '#808000',
  coral: '#FF6347', violet: '#EE82EE', indigo: '#4B0082', khaki: '#F0E68C',
  cream: '#FFFDD0', tan: '#D2B48C', lavender: '#E6E6FA', mint: '#98FF98',
  // Arabic
  احمر: '#FF0000', ازرق: '#0000FF', اسود: '#000000', ابيض: '#FFFFFF',
  اصفر: '#FFFF00', اخضر: '#008000', وردي: '#FFC0CB', بنفسجي: '#800080',
  برتقالي: '#FFA500', رمادي: '#808080', بني: '#A52A2A', ذهبي: '#FFD700',
  فضي: '#C0C0C0', كحلي: '#001F5B', زيتوني: '#808000', فيروزي: '#008080',
};

function detectColorHex(name: string): string {
  const key = name.trim().toLowerCase();
  return COLOR_NAME_MAP[key] ?? '#808080';
}

const LANG_TABS: { code: LangCode; label: string; nativeLabel: string; rtl: boolean }[] = [
  { code: 'en', label: 'EN', nativeLabel: 'English',  rtl: false },
  { code: 'es', label: 'ES', nativeLabel: 'Español',  rtl: false },
  { code: 'de', label: 'DE', nativeLabel: 'Deutsch',  rtl: false },
  { code: 'ru', label: 'RU', nativeLabel: 'Русский',  rtl: false },
  { code: 'ar', label: 'AR', nativeLabel: 'العربية',  rtl: true  },
];

const EMPTY_FORM = {
  name: '',
  price: '',
  category: 'accessories',
  description: '',
  image_url: '',
  stock: '',
  unlimited_stock: false,
  low_stock_threshold: '5',
  badge: '',
  is_featured: false,
  rating: '4.5',
  review_count: '0',
  name_ar: '',
  name_es: '',
  name_de: '',
  name_ru: '',
  description_ar: '',
  description_es: '',
  description_de: '',
  description_ru: '',
};

type FormState = typeof EMPTY_FORM;
type ToastState = { message: string; type: 'success' | 'error' };

function hasMissingTranslation(form: FormState, lang: LangCode): boolean {
  if (lang === 'en') return !form.name.trim();
  if (lang === 'ar') return !form.name_ar.trim();
  if (lang === 'es') return !form.name_es.trim();
  if (lang === 'de') return !form.name_de.trim();
  if (lang === 'ru') return !form.name_ru.trim();
  return false;
}

function countMissing(form: FormState): number {
  return ['ar', 'es', 'de', 'ru'].filter((l) => hasMissingTranslation(form, l as LangCode)).length;
}

function WebProductsScreen() {
  const { t, language } = useLanguage();
  const { admin } = useAdmin();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [langTab, setLangTab] = useState<LangCode>('en');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [colorVariants, setColorVariants] = useState<ColorVariantForm[]>([]);
  const [translating, setTranslating] = useState(false);
  const [overwriteAll, setOverwriteAll] = useState(true);
  // Re-translate modal state (from product list row)
  const [reTranslateProduct, setReTranslateProduct] = useState<Product | null>(null);
  const [reTranslateOverwrite, setReTranslateOverwrite] = useState(true);
  const [reTranslating, setReTranslating] = useState(false);
  const [reTranslateStatus, setReTranslateStatus] = useState<'idle' | 'done' | 'error'>('idle');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Auto-translate inside the edit form ──────────────────────────────────
  const handleAutoTranslate = async () => {
    if (!form.name.trim()) { showToast(t.productNameRequired ?? 'Enter a product name first', 'error'); return; }
    setTranslating(true);
    try {
      const langs = overwriteAll
        ? ['ar', 'es', 'de', 'ru']
        : (['ar', 'es', 'de', 'ru'] as const).filter((l) => {
            const nameKey = `name_${l}` as keyof FormState;
            const val = form[nameKey] as string;
            return !val?.trim() || val.trim() === form.name.trim();
          });

      if (langs.length === 0) { showToast('All translations already exist. Enable "Overwrite" to regenerate.'); setTranslating(false); return; }

      const result = await autoTranslate(
        { name: form.name.trim(), description: form.description.trim() },
        langs
      );
      setForm((f) => ({
        ...f,
        ...(result.ar ? { name_ar: result.ar.name || f.name_ar, description_ar: result.ar.description || f.description_ar } : {}),
        ...(result.es ? { name_es: result.es.name || f.name_es, description_es: result.es.description || f.description_es } : {}),
        ...(result.de ? { name_de: result.de.name || f.name_de, description_de: result.de.description || f.description_de } : {}),
        ...(result.ru ? { name_ru: result.ru.name || f.name_ru, description_ru: result.ru.description || f.description_ru } : {}),
      }));
      showToast(t.translationDone ?? 'Translations applied');
    } catch {
      showToast(t.translationFailed ?? 'Auto-translate failed', 'error');
    } finally {
      setTranslating(false);
    }
  };

  // ── Re-translate from product list: fetch EN, translate, write to DB ────
  const handleReTranslate = async () => {
    if (!reTranslateProduct) return;
    setReTranslating(true);
    setReTranslateStatus('idle');
    try {
      const enName = reTranslateProduct.name ?? '';
      const enDesc = reTranslateProduct.description ?? '';

      // Determine which languages to translate
      let targetLangs = ['ar', 'es', 'de', 'ru'];
      if (!reTranslateOverwrite) {
        const { data: existing } = await supabase
          .from('product_translations')
          .select('language, name')
          .eq('product_id', reTranslateProduct.id);
        const existingMap: Record<string, string> = {};
        for (const row of existing ?? []) existingMap[row.language] = row.name ?? '';
        targetLangs = targetLangs.filter((l) => !existingMap[l]?.trim() || existingMap[l].trim() === enName);
      }

      if (targetLangs.length === 0) {
        showToast('All translations already exist. Enable "Overwrite" to regenerate.');
        setReTranslating(false);
        return;
      }

      const result = await autoTranslate({ name: enName, description: enDesc }, targetLangs);

      const db = adminSupabase();
      const rows = targetLangs.map((lang) => {
        const r = result[lang] ?? {};
        const name = r.name?.trim() || enName;
        const desc = r.description?.trim() || enDesc;
        return { product_id: reTranslateProduct.id, language: lang, name, short_description: desc, full_description: desc, meta_title: name, meta_description: desc.slice(0, 160) };
      });

      await db.from('product_translations').upsert(rows, { onConflict: 'product_id,language' });

      // Keep legacy inline columns in sync for ar/es/de
      const legacyUpdate: Record<string, string | null> = {};
      for (const lang of targetLangs) {
        if (lang === 'ar') { legacyUpdate.name_ar = result.ar?.name || enName; legacyUpdate.description_ar = result.ar?.description || enDesc; }
        if (lang === 'es') { legacyUpdate.name_es = result.es?.name || enName; legacyUpdate.description_es = result.es?.description || enDesc; }
        if (lang === 'de') { legacyUpdate.name_de = result.de?.name || enName; legacyUpdate.description_de = result.de?.description || enDesc; }
      }
      if (Object.keys(legacyUpdate).length > 0) {
        await db.from('products').update(legacyUpdate).eq('id', reTranslateProduct.id);
      }

      setReTranslateStatus('done');
      setTimeout(() => { setReTranslateProduct(null); setReTranslateStatus('idle'); }, 2500);
    } catch {
      setReTranslateStatus('error');
    } finally {
      setReTranslating(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setGalleryImages([]);
    setColorVariants([]);
    setLangTab('en');
    setShowForm(true);
  };

  const openEdit = async (p: Product) => {
    setEditProduct(p);
    setLangTab('en');

    // Load existing translations from product_translations table
    const { data: existingTrans } = await supabase
      .from('product_translations')
      .select('language, name, short_description, full_description')
      .eq('product_id', p.id);

    const transMap: Record<string, { name: string; description: string }> = {};
    for (const row of existingTrans ?? []) {
      transMap[row.language] = {
        name: row.name ?? '',
        description: row.full_description ?? row.short_description ?? '',
      };
    }

    // Auto-fill missing translations from English so tabs are never empty
    const enName = p.name ?? '';
    const enDesc = p.description ?? '';
    setForm({
      name: enName,
      price: String(p.price ?? ''),
      category: p.category ?? 'accessories',
      description: enDesc,
      image_url: p.image_url ?? '',
      stock: String(p.stock ?? ''),
      unlimited_stock: (p as any).unlimited_stock ?? false,
      low_stock_threshold: String((p as any).low_stock_threshold ?? 5),
      badge: p.badge ?? '',
      is_featured: p.is_featured ?? false,
      rating: String(p.rating ?? '4.5'),
      review_count: String(p.review_count ?? '0'),
      name_ar: transMap['ar']?.name ?? p.name_ar ?? enName,
      name_es: transMap['es']?.name ?? p.name_es ?? enName,
      name_de: transMap['de']?.name ?? p.name_de ?? enName,
      name_ru: transMap['ru']?.name ?? enName,
      description_ar: transMap['ar']?.description ?? p.description_ar ?? enDesc,
      description_es: transMap['es']?.description ?? p.description_es ?? enDesc,
      description_de: transMap['de']?.description ?? p.description_de ?? enDesc,
      description_ru: transMap['ru']?.description ?? enDesc,
    });

    const { data: imgs } = await supabase
      .from('product_images')
      .select('id, url, is_main, sort_order')
      .eq('product_id', p.id)
      .order('sort_order', { ascending: true });

    let gallery: GalleryImage[] = [];
    if (imgs && imgs.length > 0) {
      // Sort: main first, then by sort_order
      const sorted = [...imgs].sort((a, b) => {
        if (a.is_main && !b.is_main) return -1;
        if (!a.is_main && b.is_main) return 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      gallery = sorted.map((img: any) => ({ id: img.id, url: img.url, isMain: img.is_main }));
    } else if (p.image_url || (p as any).main_image) {
      // Legacy product with no gallery rows — seed from scalar field
      const primaryUrl = p.image_url || (p as any).main_image;
      gallery = [{ id: 'tmp_legacy_' + p.id, url: primaryUrl, isMain: true }];
    }
    setGalleryImages(gallery);

    // Load color variants
    const { data: variants } = await supabase
      .from('product_color_variants')
      .select('*')
      .eq('product_id', p.id)
      .order('sort_order', { ascending: true });
    setColorVariants(
      (variants ?? []).map((v: any) => ({
        id: v.id,
        name: v.name,
        hex: v.hex,
        image_url: v.image_url ?? '',
        is_default: v.is_default,
        stock: v.stock != null ? String(v.stock) : '',
      }))
    );

    // Sync form.image_url to the gallery primary
    const primaryImg = gallery.find((img) => img.isMain) ?? gallery[0];
    if (primaryImg) {
      setForm((f) => ({ ...f, image_url: primaryImg.url }));
    }

    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Product name is required', 'error'); return; }
    if (!form.price || isNaN(Number(form.price))) { showToast('Valid price required', 'error'); return; }
    setSaving(true);

    // Primary image = first main-flagged gallery item, then first gallery item, then form field
    const mainGalleryImg = galleryImages.find(img => img.isMain) ?? galleryImages[0];
    const imageVal = mainGalleryImg?.url || form.image_url.trim() || null;
    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      category: form.category,
      description: form.description.trim(),
      image_url: imageVal,
      main_image: imageVal,
      stock: parseInt(form.stock) || 0,
      unlimited_stock: form.unlimited_stock,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
      badge: form.badge.trim() || null,
      is_featured: form.is_featured,
      rating: parseFloat(form.rating) || 4.5,
      review_count: parseInt(form.review_count) || 0,
      name_ar: form.name_ar.trim() || null,
      name_es: form.name_es.trim() || null,
      name_de: form.name_de.trim() || null,
      description_ar: form.description_ar.trim() || null,
      description_es: form.description_es.trim() || null,
      description_de: form.description_de.trim() || null,
    };

    const db = adminSupabase();
    let productId: string;

    if (editProduct) {
      const { error } = await db.from('products').update(payload).eq('id', editProduct.id);
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      productId = editProduct.id;
      logAudit({ adminId: admin!.id, adminEmail: admin!.email, action: 'product.update', entityType: 'product', entityId: productId, entityLabel: payload.name, oldValues: { name: editProduct.name, price: editProduct.price, status: (editProduct as any).status }, newValues: { name: payload.name, price: payload.price } });
    } else {
      const { data: newP, error } = await db.from('products').insert(payload).select().maybeSingle();
      if (error || !newP) { showToast(error ? 'Save failed: ' + error.message : 'Failed to create product', 'error'); setSaving(false); return; }
      productId = newP.id;
      logAudit({ adminId: admin!.id, adminEmail: admin!.email, action: 'product.create', entityType: 'product', entityId: productId, entityLabel: payload.name, newValues: { name: payload.name, price: payload.price, category: payload.category } });
    }

    // ── Persist gallery: delete all existing rows, then re-insert in order ──
    // This is the simplest atomic approach — order and is_main are always correct.
    await db.from('product_images').delete().eq('product_id', productId);

    const galleryToSave: GalleryImage[] = galleryImages.length > 0
      ? galleryImages
      : imageVal
        ? [{ id: 'ignored', url: imageVal, isMain: true }]
        : [];

    if (galleryToSave.length > 0) {
      // Ensure exactly one main — use explicit flag, fallback to first
      let hasMain = galleryToSave.some(img => img.isMain);
      await Promise.all(
        galleryToSave.map((img, i) =>
          db.from('product_images').insert({
            product_id: productId,
            url: img.url,
            is_main: hasMain ? img.isMain : i === 0,
            sort_order: i,
          })
        )
      );
    }

    // ── Persist color variants: delete all then re-insert ──
    await adminSupabase().from('product_color_variants').delete().eq('product_id', productId);
    if (colorVariants.length > 0) {
      const hasDefault = colorVariants.some((v) => v.is_default);
      await adminSupabase().from('product_color_variants').insert(
        colorVariants.map((v, i) => ({
          product_id: productId,
          name: v.name.trim(),
          hex: v.hex,
          image_url: v.image_url.trim() || null,
          is_default: hasDefault ? v.is_default : i === 0,
          sort_order: i,
          stock: v.stock.trim() !== '' ? parseInt(v.stock) : null,
        }))
      );
    }

    // Upsert product_translations for all non-English languages
    // Use English as fallback for any empty translation fields
    const enName = form.name.trim();
    const enDesc = form.description.trim();
    const transRows: { lang: LangCode; name: string; description: string }[] = [
      { lang: 'ar', name: form.name_ar.trim() || enName, description: form.description_ar.trim() || enDesc },
      { lang: 'es', name: form.name_es.trim() || enName, description: form.description_es.trim() || enDesc },
      { lang: 'de', name: form.name_de.trim() || enName, description: form.description_de.trim() || enDesc },
      { lang: 'ru', name: form.name_ru.trim() || enName, description: form.description_ru.trim() || enDesc },
    ];

    await Promise.all(
      transRows.map(({ lang, name, description }) =>
        db.from('product_translations').upsert(
          {
            product_id: productId,
            language: lang,
            name,
            short_description: description,
            full_description: description,
            meta_title: name,
            meta_description: description.slice(0, 160),
          },
          { onConflict: 'product_id,language' }
        )
      )
    );

    await fetchProducts();
    setSaving(false);
    setShowForm(false);
    showToast(editProduct ? 'Product updated' : 'Product created');
  };

  const handleDelete = async (p: Product) => {
    setDeleting(p.id);
    await adminSupabase().from('products').update({ deleted_at: new Date().toISOString() }).eq('id', p.id);
    logAudit({ adminId: admin!.id, adminEmail: admin!.email, action: 'product.delete', entityType: 'product', entityId: p.id, entityLabel: p.name });
    await fetchProducts();
    setDeleting(null);
    setConfirmDelete(null);
    showToast('Product deleted');
  };

  const filtered = products.filter(
    (p) =>
      search.trim() === '' ||
      (p.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t.searchProducts}
            placeholderTextColor={Colors.textMuted}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Plus size={18} color={Colors.background} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>{t.addProduct}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>{t.noProductsFound}</Text>
      ) : (
        filtered.map((p) => (
          <View key={p.id} style={styles.productCard}>
            <View style={styles.productThumb}>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <Package size={24} color={Colors.textMuted} strokeWidth={1.5} />
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{getProductName(p, language)}</Text>
              <Text style={styles.productMeta}>{p.category} · ${p.price}</Text>
              <View style={styles.stockBadgeRow}>
                {(p as any).unlimited_stock ? (
                  <View style={[styles.stockBadge, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '55' }]}>
                    <Text style={[styles.stockBadgeText, { color: Colors.success }]}>Unlimited</Text>
                  </View>
                ) : p.stock === 0 ? (
                  <View style={[styles.stockBadge, { backgroundColor: Colors.error + '22', borderColor: Colors.error + '55' }]}>
                    <Text style={[styles.stockBadgeText, { color: Colors.error }]}>Out of Stock</Text>
                  </View>
                ) : p.stock <= ((p as any).low_stock_threshold ?? 5) ? (
                  <View style={[styles.stockBadge, { backgroundColor: Colors.warning + '22', borderColor: Colors.warning + '55' }]}>
                    <Text style={[styles.stockBadgeText, { color: Colors.warning }]}>Low: {p.stock}</Text>
                  </View>
                ) : (
                  <View style={[styles.stockBadge, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '55' }]}>
                    <Text style={[styles.stockBadgeText, { color: Colors.success }]}>In Stock: {p.stock}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.productActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(p)} activeOpacity={0.7}>
                <Pencil size={16} color={Colors.neonBlue} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(0,191,255,0.08)', borderColor: 'rgba(0,191,255,0.25)' }]}
                onPress={() => { setReTranslateProduct(p); setReTranslateOverwrite(true); setReTranslateStatus('idle'); }}
                activeOpacity={0.7}
              >
                <RefreshCw size={15} color={Colors.neonBlue} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.error + '18' }]}
                onPress={() => setConfirmDelete(p)}
                activeOpacity={0.7}
              >
                {deleting === p.id ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <Trash2 size={16} color={Colors.error} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editProduct ? t.editProduct : t.addProduct}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} activeOpacity={0.7}>
              <X size={22} color={Colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.langTabs}>
              {LANG_TABS.map((l) => {
                const missing = hasMissingTranslation(form, l.code);
                return (
                  <TouchableOpacity
                    key={l.code}
                    style={[styles.langTab, langTab === l.code && styles.langTabActive]}
                    onPress={() => setLangTab(l.code)}
                    activeOpacity={0.7}
                  >
                    {missing && l.code !== 'en' ? (
                      <AlertCircle size={12} color={Colors.warning} strokeWidth={2} />
                    ) : !missing && l.code !== 'en' ? (
                      <CheckCircle size={12} color={Colors.success} strokeWidth={2} />
                    ) : null}
                    <Text style={[styles.langTabText, langTab === l.code && styles.langTabTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {langTab === 'en' && (
              <>
                <FormField label={t.nameRequired2} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Product name" />
                <FormField label={t.descriptionField} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Description" multiline />
                <FormField label="Price *" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} placeholder={t.pricePlaceholder} keyboardType="decimal-pad" />
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Unlimited Stock</Text>
                  <Switch
                    value={form.unlimited_stock}
                    onValueChange={(v) => setForm((f) => ({ ...f, unlimited_stock: v }))}
                    thumbColor={form.unlimited_stock ? Colors.success : Colors.textMuted}
                    trackColor={{ false: Colors.border, true: Colors.success + '55' }}
                  />
                </View>
                {!form.unlimited_stock && (
                  <View style={styles.stockRow}>
                    <View style={{ flex: 2 }}>
                      <FormField label="Stock Quantity" value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} placeholder={t.stockPlaceholder} keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Low Stock Alert" value={form.low_stock_threshold} onChangeText={(v) => setForm((f) => ({ ...f, low_stock_threshold: v }))} placeholder="5" keyboardType="number-pad" />
                    </View>
                  </View>
                )}
                <FormField label="Badge" value={form.badge} onChangeText={(v) => setForm((f) => ({ ...f, badge: v }))} placeholder={t.badgePlaceholder} />
                <Text style={styles.fieldLabel}>{t.categoryField}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catChip, form.category === cat && styles.catChipActive]}
                        onPress={() => setForm((f) => ({ ...f, category: cat }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.catChipText, form.category === cat && styles.catChipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>{t.featuredField}</Text>
                  <Switch
                    value={form.is_featured}
                    onValueChange={(v) => setForm((f) => ({ ...f, is_featured: v }))}
                    thumbColor={form.is_featured ? Colors.neonBlue : Colors.textMuted}
                    trackColor={{ false: Colors.border, true: Colors.neonBlueBorder }}
                  />
                </View>
                <Text style={styles.fieldLabel}>{t.mainImage}</Text>
                <ImageUploader
                  value={form.image_url}
                  onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
                  folder="products"
                />
                <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t.imageGallery ?? 'Image Gallery'}</Text>
                <ProductImageGallery
                  images={galleryImages}
                  onChange={setGalleryImages}
                />

                {/* ── Color Variants ── */}
                <View style={styles.colorSection}>
                  <View style={styles.colorSectionHeader}>
                    <Palette size={15} color={Colors.neonBlue} strokeWidth={2} />
                    <Text style={styles.colorSectionTitle}>Color Variants</Text>
                    <TouchableOpacity
                      style={styles.addColorBtn}
                      onPress={() =>
                        setColorVariants((prev) => [
                          ...prev,
                          { name: '', hex: '#808080', image_url: '', is_default: prev.length === 0, stock: '' },
                        ])
                      }
                      activeOpacity={0.7}
                    >
                      <Plus size={13} color={Colors.neonBlue} strokeWidth={2.5} />
                      <Text style={styles.addColorBtnText}>Add Color</Text>
                    </TouchableOpacity>
                  </View>

                  {colorVariants.map((variant, idx) => (
                    <View key={idx} style={styles.colorVariantCard}>
                      {/* Top row: swatch + name input + default + delete */}
                      <View style={styles.colorVariantTopRow}>
                        <View style={[styles.colorPreview, { backgroundColor: variant.hex }]} />
                        <TextInput
                          style={styles.colorNameInput}
                          value={variant.name}
                          onChangeText={(v) => {
                            const hex = detectColorHex(v);
                            setColorVariants((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, name: v, hex } : c))
                            );
                          }}
                          placeholder="Color name (e.g. Red, Blue, Black)"
                          placeholderTextColor={Colors.textMuted}
                        />
                        <TouchableOpacity
                          style={[styles.defaultBtn, variant.is_default && styles.defaultBtnActive]}
                          onPress={() =>
                            setColorVariants((prev) =>
                              prev.map((c, i) => ({ ...c, is_default: i === idx }))
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.defaultBtnText, variant.is_default && styles.defaultBtnTextActive]}>
                            {variant.is_default ? 'Default' : 'Set default'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteColorBtn}
                          onPress={() =>
                            setColorVariants((prev) => {
                              const next = prev.filter((_, i) => i !== idx);
                              if (variant.is_default && next.length > 0) {
                                next[0] = { ...next[0], is_default: true };
                              }
                              return next;
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>

                      {/* Detected color + stock row */}
                      <View style={styles.colorMetaRow}>
                        <View style={styles.detectedColorRow}>
                          <View style={[styles.detectedDot, { backgroundColor: variant.hex }]} />
                          <Text style={styles.detectedColorText}>
                            {variant.hex}
                            {variant.name.trim() && !COLOR_NAME_MAP[variant.name.trim().toLowerCase()]
                              ? ' (unknown)'
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.colorStockField}>
                          <Text style={styles.colorStockLabel}>Stock</Text>
                          <TextInput
                            style={styles.colorStockInput}
                            value={variant.stock}
                            onChangeText={(v) =>
                              setColorVariants((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, stock: v } : c))
                              )
                            }
                            placeholder="∞"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>

                      {/* Image uploader for this color */}
                      <ImageUploader
                        value={variant.image_url}
                        onChange={(url) =>
                          setColorVariants((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, image_url: url } : c))
                          )
                        }
                        folder="products"
                        label="Color image (optional)"
                        previewHeight={100}
                        compact
                      />
                    </View>
                  ))}

                  {colorVariants.length === 0 && (
                    <Text style={styles.noColorsText}>
                      No color variants — product shows default images
                    </Text>
                  )}
                </View>
              </>
            )}
            {langTab === 'ar' && (
              <>
                <FormField label={t.nameArabic} value={form.name_ar} onChangeText={(v) => setForm((f) => ({ ...f, name_ar: v }))} placeholder="اسم المنتج" rtl />
                <FormField label={t.descArabic} value={form.description_ar} onChangeText={(v) => setForm((f) => ({ ...f, description_ar: v }))} placeholder="الوصف" multiline rtl />
              </>
            )}
            {langTab === 'es' && (
              <>
                <FormField label={t.nameSpanish} value={form.name_es} onChangeText={(v) => setForm((f) => ({ ...f, name_es: v }))} placeholder="Nombre del producto" />
                <FormField label={t.descSpanish} value={form.description_es} onChangeText={(v) => setForm((f) => ({ ...f, description_es: v }))} placeholder="Descripción" multiline />
              </>
            )}
            {langTab === 'de' && (
              <>
                <FormField label={t.nameGerman} value={form.name_de} onChangeText={(v) => setForm((f) => ({ ...f, name_de: v }))} placeholder="Produktname" />
                <FormField label={t.descGerman} value={form.description_de} onChangeText={(v) => setForm((f) => ({ ...f, description_de: v }))} placeholder="Beschreibung" multiline />
              </>
            )}
            {langTab === 'ru' && (
              <>
                <FormField label={t.nameRussian} value={form.name_ru} onChangeText={(v) => setForm((f) => ({ ...f, name_ru: v }))} placeholder="Название товара" />
                <FormField label={t.descRussian} value={form.description_ru} onChangeText={(v) => setForm((f) => ({ ...f, description_ru: v }))} placeholder="Описание" multiline />
              </>
            )}
            {/* Overwrite checkbox for auto-translate */}
            <TouchableOpacity
              style={styles.overwriteRow}
              onPress={() => setOverwriteAll((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, overwriteAll && styles.checkboxChecked]}>
                {overwriteAll && <CheckCircle size={12} color={Colors.background} strokeWidth={3} />}
              </View>
              <Text style={styles.overwriteLabel}>{t.overwriteTranslations ?? 'Overwrite existing translations'}</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.translateBtn, translating && { opacity: 0.6 }]}
              onPress={handleAutoTranslate}
              activeOpacity={0.8}
              disabled={translating || saving}
            >
              {translating
                ? <ActivityIndicator color={Colors.neonBlue} size="small" />
                : <><Globe size={15} color={Colors.neonBlue} strokeWidth={2} /><Text style={styles.translateBtnText}>{t.autoTranslate ?? 'Auto-Translate'}</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving || translating}>
              {saving ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.saveBtnText}>{t.save}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!confirmDelete}
        title={t.deleteProduct ?? 'Delete Product'}
        message={confirmDelete ? `"${confirmDelete.name}" will be removed from your store.` : ''}
        confirmLabel={t.delete ?? 'Delete'}
        loading={deleting === confirmDelete?.id}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Re-Translate modal */}
      <Modal
        visible={!!reTranslateProduct}
        animationType="fade"
        transparent
        onRequestClose={() => !reTranslating && setReTranslateProduct(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.reTranslateBox}>
            {/* Header */}
            <View style={styles.reTranslateHeader}>
              <View style={styles.reTranslateIconWrap}>
                <Globe size={20} color={Colors.neonBlue} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reTranslateTitle}>{t.reTranslate ?? 'Re-Translate'}</Text>
                <Text style={styles.reTranslateProduct} numberOfLines={1}>{reTranslateProduct?.name}</Text>
              </View>
              {!reTranslating && (
                <TouchableOpacity onPress={() => setReTranslateProduct(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={18} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            {/* Info */}
            <Text style={styles.reTranslateDesc}>{t.reTranslateDesc ?? 'Translate the English name and description into AR, ES, DE, and RU using AI.'}</Text>

            {/* Overwrite checkbox */}
            <TouchableOpacity
              style={styles.overwriteRow}
              onPress={() => !reTranslating && setReTranslateOverwrite((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, reTranslateOverwrite && styles.checkboxChecked]}>
                {reTranslateOverwrite && <CheckCircle size={12} color={Colors.background} strokeWidth={3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.overwriteLabel}>{t.overwriteTranslations ?? 'Overwrite existing translations'}</Text>
                <Text style={styles.overwriteHint}>
                  {reTranslateOverwrite
                    ? (t.overwriteOnDesc ?? 'All 4 languages will be regenerated')
                    : (t.overwriteOffDesc ?? 'Only missing or English-fallback translations will be filled')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Target languages indicator */}
            <View style={styles.langChips}>
              {(['AR', 'ES', 'DE', 'RU'] as const).map((l) => (
                <View key={l} style={styles.langChip}>
                  <Text style={styles.langChipText}>{l}</Text>
                </View>
              ))}
            </View>

            {/* Status message */}
            {reTranslateStatus === 'done' && (
              <View style={styles.statusSuccess}>
                <CheckCircle size={16} color={Colors.success} strokeWidth={2.5} />
                <Text style={styles.statusSuccessText}>{t.translationsUpdated ?? 'Translations updated successfully'}</Text>
              </View>
            )}
            {reTranslateStatus === 'error' && (
              <View style={styles.statusError}>
                <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
                <Text style={styles.statusErrorText}>{t.translationFailed ?? 'Translation failed. Please try again.'}</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.reTranslateBtns}>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 0, paddingHorizontal: Spacing.lg }]}
                onPress={() => setReTranslateProduct(null)}
                disabled={reTranslating}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reTranslateRunBtn, reTranslating && { opacity: 0.7 }]}
                onPress={handleReTranslate}
                disabled={reTranslating}
                activeOpacity={0.8}
              >
                {reTranslating ? (
                  <>
                    <ActivityIndicator color={Colors.background} size="small" />
                    <Text style={styles.saveBtnText}>{t.translating ?? 'Translating...'}</Text>
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} color={Colors.background} strokeWidth={2.5} />
                    <Text style={styles.saveBtnText}>{t.reTranslate ?? 'Re-Translate'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MobileProductsScreen() {
  const { t, language } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', stock: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, stock, category, image_url, is_featured, rating, review_count')
      .order('created_at', { ascending: false });
    if (error) console.error('fetchProducts error:', error);
    setProducts(data ?? []);
    setLoading(false);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      name: p.name ?? '',
      price: String(p.price ?? ''),
      stock: String(p.stock ?? ''),
    });
  };

  const handleSave = async () => {
    if (!editProduct) return;
    if (!editForm.name.trim()) { showToast('Product name is required', 'error'); return; }
    const price = parseFloat(editForm.price);
    if (isNaN(price) || price < 0) { showToast('Enter a valid price', 'error'); return; }
    setSaving(true);
    const { error } = await adminSupabase()
      .from('products')
      .update({
        name: editForm.name.trim(),
        price,
        stock: parseInt(editForm.stock) || 0,
      })
      .eq('id', editProduct.id);
    setSaving(false);
    if (error) {
      console.error('Product update failed:', error.message, error);
      showToast('Save failed: ' + error.message, 'error');
      return;
    }
    await fetchProducts();
    showToast('Product saved');
    setTimeout(() => setEditProduct(null), 400);
  };

  const filtered = products.filter(
    (p) =>
      search.trim() === '' ||
      (p.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (editProduct) {
    return (
      <View style={styles.detailContainer}>
        {toast && <Toast message={toast.message} type={toast.type} />}
        <TouchableOpacity style={styles.backRow} onPress={() => setEditProduct(null)} activeOpacity={0.7}>
          <Text style={styles.backLink}>{t.backToProducts}</Text>
        </TouchableOpacity>

        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>{t.editProduct}</Text>
          <Text style={styles.editCardSub} numberOfLines={1}>{editProduct.name}</Text>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>{t.productNameField}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.name}
              onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
              placeholder="Product name"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>{t.priceField}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.price}
              onChangeText={(v) => setEditForm((f) => ({ ...f, price: v }))}
              placeholder={t.pricePlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>{t.stockField}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.stock}
              onChangeText={(v) => setEditForm((f) => ({ ...f, stock: v }))}
              placeholder={t.stockPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t.saveChanges2}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.searchBox}>
        <Search size={16} color={Colors.textMuted} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchProducts}
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>{t.noProductsFound}</Text>
      ) : (
        filtered.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.mobileProductCard}
            onPress={() => openEdit(p)}
            activeOpacity={0.8}
          >
            <View style={styles.productThumb}>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <Package size={22} color={Colors.textMuted} strokeWidth={1.5} />
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.productMeta}>{p.category}</Text>
              <Text style={styles.productStock}>${p.price} · Stock: {p.stock}</Text>
            </View>
            <Pencil size={16} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function FormField({
  label, value, onChangeText, placeholder, multiline, keyboardType, rtl,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any; rtl?: boolean;
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlign={rtl ? 'right' : 'left'}
      />
    </View>
  );
}

function ProductsScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.products} showBack>
        <MobileProductsScreen />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.products}>
      <WebProductsScreen />
    </AdminWebDashboard>
  );
}

export default function ProductsScreenGuarded() {
  return (
    <AdminGuard permission="manage_products">
      <ProductsScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
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
    flex: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  addBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  productCard: {
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
  mobileProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  productMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  productStock: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  productActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neonBlueGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  modal: {
    flex: 1,
    backgroundColor: '#070D1A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  modalBody: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
  },
  langTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  langTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langTabActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  langTabText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  langTabTextActive: {
    color: Colors.neonBlue,
  },
  editField: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  catChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  catChipTextActive: {
    color: Colors.neonBlue,
  },
  // Color variants
  colorSection: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  colorSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  colorSectionTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  addColorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  addColorBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  colorVariantCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 8,
  },
  colorVariantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  colorNameInput: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  detectedColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  detectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  detectedColorText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  defaultBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  defaultBtnActive: {
    borderColor: Colors.success + '55',
    backgroundColor: Colors.success + '18',
  },
  defaultBtnText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  defaultBtnTextActive: {
    color: Colors.success,
  },
  deleteColorBtn: {
    padding: 5,
  },
  noColorsText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  stockRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  stockBadgeRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  stockBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  colorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  colorStockField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorStockLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  colorStockInput: {
    width: 60,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  translateBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow ?? 'rgba(0,191,255,0.08)',
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder ?? 'rgba(0,191,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  translateBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  confirmBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  confirmMsg: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  // Overwrite checkbox
  overwriteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(0,191,255,0.04)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  overwriteLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  overwriteHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  // Re-translate modal
  reTranslateBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  reTranslateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reTranslateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reTranslateTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  reTranslateProduct: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  reTranslateDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  langChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  langChipText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.success + '15',
    borderWidth: 1,
    borderColor: Colors.success + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  statusSuccessText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  statusError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  statusErrorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  reTranslateBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    justifyContent: 'flex-end',
  },
  reTranslateRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
  },
  detailContainer: {
    paddingBottom: 40,
  },
  backRow: {
    marginBottom: Spacing.md,
  },
  backLink: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  editCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  editCardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  editCardSub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  successBanner: {
    backgroundColor: Colors.success + '22',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
