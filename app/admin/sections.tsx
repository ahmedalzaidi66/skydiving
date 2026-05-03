import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Check, Package, Search, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { adminSupabase } from '@/lib/supabase';
import { fetchProducts, getProductName, getProductImage, Product } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import AdminWebLayout from '@/components/admin/AdminWebLayout';
import AdminMobileLayout from '@/components/admin/AdminMobileLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type HomeSection = {
  id: string;
  name_en: string;
  name_ar: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
};

type SectionProduct = {
  id: string;
  section_id: string;
  product_id: string;
  sort_order: number;
  product?: Product;
};

// ─── Inner screen (no auth guard) ─────────────────────────────────────────────

function SectionsScreen() {
  const { isMobile } = useAdminLayout();
  const { t, language } = useLanguage();

  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Section form modal
  const [sectionModal, setSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [formNameEn, setFormNameEn] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formError, setFormError] = useState('');

  // Products inside a section
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [sectionProducts, setSectionProducts] = useState<Record<string, SectionProduct[]>>({});
  const [loadingSectionProducts, setLoadingSectionProducts] = useState<Record<string, boolean>>({});

  // Add product modal
  const [addProductModal, setAddProductModal] = useState(false);
  const [addProductSectionId, setAddProductSectionId] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<HomeSection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const loadSections = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const { data, error } = await adminSupabase()
        .from('home_sections')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          setDbError('Table "home_sections" does not exist. Run the database migration to create it.');
        } else {
          setDbError(error.message);
        }
        setSections([]);
      } else {
        setSections((data as HomeSection[]) ?? []);
      }
    } catch (e: any) {
      setDbError(e?.message ?? 'Failed to load sections');
      setSections([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const loadSectionProducts = useCallback(async (sectionId: string) => {
    setLoadingSectionProducts((prev) => ({ ...prev, [sectionId]: true }));
    try {
      const { data } = await adminSupabase()
        .from('home_section_products')
        .select('*')
        .eq('section_id', sectionId)
        .order('sort_order', { ascending: true });

      if (!data || data.length === 0) {
        setSectionProducts((prev) => ({ ...prev, [sectionId]: [] }));
        return;
      }

      const ids = (data as SectionProduct[]).map((sp) => sp.product_id);
      const { data: products } = await adminSupabase()
        .from('products')
        .select('*')
        .in('id', ids);

      const productMap: Record<string, Product> = {};
      (products ?? []).forEach((p: any) => { productMap[p.id] = p; });

      const enriched: SectionProduct[] = (data as SectionProduct[]).map((sp) => ({
        ...sp,
        product: productMap[sp.product_id],
      }));
      setSectionProducts((prev) => ({ ...prev, [sectionId]: enriched }));
    } finally {
      setLoadingSectionProducts((prev) => ({ ...prev, [sectionId]: false }));
    }
  }, []);

  const toggleExpand = async (sectionId: string) => {
    if (expandedSectionId === sectionId) {
      setExpandedSectionId(null);
    } else {
      setExpandedSectionId(sectionId);
      if (!sectionProducts[sectionId]) {
        await loadSectionProducts(sectionId);
      }
    }
  };

  // ── Section CRUD ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingSection(null);
    setFormNameEn('');
    setFormNameAr('');
    setFormEnabled(true);
    setFormError('');
    setSectionModal(true);
  };

  const openEdit = (s: HomeSection) => {
    setEditingSection(s);
    setFormNameEn(s.name_en);
    setFormNameAr(s.name_ar);
    setFormEnabled(s.enabled);
    setFormError('');
    setSectionModal(true);
  };

  const saveSection = async () => {
    if (!formNameEn.trim()) {
      setFormError('English name is required.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      const db = adminSupabase();
      if (editingSection) {
        const { error } = await db.from('home_sections').update({
          name_en: formNameEn.trim(),
          name_ar: formNameAr.trim(),
          enabled: formEnabled,
        }).eq('id', editingSection.id);
        if (error) { setFormError(error.message); return; }
      } else {
        const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order), -1);
        const { error } = await db.from('home_sections').insert({
          name_en: formNameEn.trim(),
          name_ar: formNameAr.trim(),
          enabled: formEnabled,
          sort_order: maxOrder + 1,
        });
        if (error) { setFormError(error.message); return; }
      }
      setSectionModal(false);
      await loadSections();
      showToast(t.sectionSaved ?? 'Section saved');
    } finally {
      setSaving(false);
    }
  };

  const doDeleteSection = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await adminSupabase().from('home_sections').delete().eq('id', deleteConfirm.id);
    setDeleting(false);
    setDeleteConfirm(null);
    setSectionProducts((prev) => { const c = { ...prev }; delete c[deleteConfirm.id]; return c; });
    if (expandedSectionId === deleteConfirm.id) setExpandedSectionId(null);
    await loadSections();
    showToast(t.sectionDeleted ?? 'Section deleted');
  };

  const toggleEnabled = async (s: HomeSection) => {
    await adminSupabase().from('home_sections').update({ enabled: !s.enabled }).eq('id', s.id);
    setSections((prev) => prev.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x));
  };

  // ── Section reorder ───────────────────────────────────────────────────────

  const moveSectionUp = async (index: number) => {
    if (index === 0) return;
    const list = [...sections];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    const updated = list.map((s, i) => ({ ...s, sort_order: i }));
    setSections(updated);
    const db = adminSupabase();
    await Promise.all(updated.map((s) => db.from('home_sections').update({ sort_order: s.sort_order }).eq('id', s.id)));
  };

  const moveSectionDown = async (index: number) => {
    if (index >= sections.length - 1) return;
    const list = [...sections];
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    const updated = list.map((s, i) => ({ ...s, sort_order: i }));
    setSections(updated);
    const db = adminSupabase();
    await Promise.all(updated.map((s) => db.from('home_sections').update({ sort_order: s.sort_order }).eq('id', s.id)));
  };

  // ── Products in section ───────────────────────────────────────────────────

  const openAddProduct = async (sectionId: string) => {
    setAddProductSectionId(sectionId);
    setProductSearch('');
    setAddProductModal(true);
    if (allProducts.length === 0) {
      setLoadingProducts(true);
      const products = await fetchProducts({ language: 'en' });
      setAllProducts(products);
      setLoadingProducts(false);
    }
  };

  const addProductToSection = async (product: Product) => {
    if (!addProductSectionId) return;
    const existing = sectionProducts[addProductSectionId] ?? [];
    if (existing.some((sp) => sp.product_id === product.id)) return;
    const maxOrder = existing.reduce((m, sp) => Math.max(m, sp.sort_order), -1);
    await adminSupabase().from('home_section_products').insert({
      section_id: addProductSectionId,
      product_id: product.id,
      sort_order: maxOrder + 1,
    });
    await loadSectionProducts(addProductSectionId);
    showToast(t.productAdded ?? 'Product added');
  };

  const removeProductFromSection = async (sp: SectionProduct) => {
    await adminSupabase().from('home_section_products').delete().eq('id', sp.id);
    await loadSectionProducts(sp.section_id);
    showToast(t.productRemoved ?? 'Product removed');
  };

  const moveProductUp = async (sectionId: string, index: number) => {
    const list = [...(sectionProducts[sectionId] ?? [])];
    if (index === 0) return;
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    const updated = list.map((sp, i) => ({ ...sp, sort_order: i }));
    setSectionProducts((prev) => ({ ...prev, [sectionId]: updated }));
    const db = adminSupabase();
    await Promise.all(updated.map((sp) => db.from('home_section_products').update({ sort_order: sp.sort_order }).eq('id', sp.id)));
  };

  const moveProductDown = async (sectionId: string, index: number) => {
    const list = [...(sectionProducts[sectionId] ?? [])];
    if (index >= list.length - 1) return;
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    const updated = list.map((sp, i) => ({ ...sp, sort_order: i }));
    setSectionProducts((prev) => ({ ...prev, [sectionId]: updated }));
    const db = adminSupabase();
    await Promise.all(updated.map((sp) => db.from('home_section_products').update({ sort_order: sp.sort_order }).eq('id', sp.id)));
  };

  const filteredProducts = allProducts.filter((p) => {
    const q = productSearch.toLowerCase();
    return !q || getProductName(p, 'en').toLowerCase().includes(q);
  });

  const alreadyInSection = new Set(
    (sectionProducts[addProductSectionId ?? ''] ?? []).map((sp) => sp.product_id)
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const title = t.homeSections ?? 'Home Sections';
  const subtitle = t.homeSectionsSubtitle ?? 'Manage product sections shown on the homepage';

  const content = (
    <View style={s.root}>
      {/* Header row with count + add button — always visible */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.pageHeading}>{title}</Text>
          <Text style={s.pageSubheading}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
          <Plus size={16} color={Colors.background} strokeWidth={2.5} />
          <Text style={s.addBtnText}>{t.addSection ?? 'Add Section'}</Text>
        </TouchableOpacity>
      </View>

      {/* DB error banner */}
      {dbError && (
        <View style={s.errorBanner}>
          <AlertTriangle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={s.errorBannerText}>{dbError}</Text>
          <TouchableOpacity onPress={loadSections} style={s.retryBtn} activeOpacity={0.8}>
            <Text style={s.retryBtnText}>{t.retry ?? 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
          <Text style={s.loadingText}>{t.loading ?? 'Loading...'}</Text>
        </View>
      )}

      {/* Empty state — shown when loaded and no DB error */}
      {!loading && !dbError && sections.length === 0 && (
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Package size={40} color={Colors.textMuted} strokeWidth={1.2} />
          </View>
          <Text style={s.emptyTitle}>{t.noSectionsYet ?? 'No sections yet'}</Text>
          <Text style={s.emptySubtitle}>{t.addFirstSection ?? 'Create your first homepage section'}</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={openCreate} activeOpacity={0.8}>
            <Plus size={16} color={Colors.background} strokeWidth={2.5} />
            <Text style={s.emptyAddBtnText}>{t.addSection ?? 'Add Section'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Section list */}
      {!loading && sections.length > 0 && (
        <View style={s.list}>
          {sections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              index={idx}
              total={sections.length}
              language={language}
              t={t}
              expanded={expandedSectionId === section.id}
              sectionProducts={sectionProducts[section.id]}
              loadingProducts={loadingSectionProducts[section.id] ?? false}
              onToggleExpand={() => toggleExpand(section.id)}
              onEdit={() => openEdit(section)}
              onDelete={() => setDeleteConfirm(section)}
              onToggleEnabled={() => toggleEnabled(section)}
              onMoveUp={() => moveSectionUp(idx)}
              onMoveDown={() => moveSectionDown(idx)}
              onAddProduct={() => openAddProduct(section.id)}
              onRemoveProduct={removeProductFromSection}
              onMoveProductUp={(i) => moveProductUp(section.id, i)}
              onMoveProductDown={(i) => moveProductDown(section.id, i)}
            />
          ))}
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={s.toast}>
          <Check size={13} color={Colors.success} strokeWidth={2.5} />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {/* ── Section form modal ── */}
      <Modal
        visible={sectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSectionModal(false)}
      >
        <View style={s.backdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {editingSection ? (t.editSection ?? 'Edit Section') : (t.addSection ?? 'Add Section')}
              </Text>
              <TouchableOpacity onPress={() => setSectionModal(false)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>{t.sectionNameEn ?? 'Section Name (English)'} *</Text>
              <TextInput
                style={[s.fieldInput, !!formError && !formNameEn.trim() && s.fieldInputError]}
                value={formNameEn}
                onChangeText={(v) => { setFormNameEn(v); if (formError) setFormError(''); }}
                placeholder="e.g. Best Sellers"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>{t.sectionNameAr ?? 'Section Name (Arabic)'}</Text>
              <TextInput
                style={[s.fieldInput, s.fieldInputRTL]}
                value={formNameAr}
                onChangeText={setFormNameAr}
                placeholder="مثال: الأكثر مبيعاً"
                placeholderTextColor={Colors.textMuted}
                textAlign="right"
                autoCorrect={false}
              />
            </View>

            <View style={s.switchRow}>
              <View>
                <Text style={s.fieldLabel}>{t.sectionEnabled ?? 'Enabled'}</Text>
                <Text style={s.switchHint}>
                  {formEnabled ? 'Visible on homepage' : 'Hidden from homepage'}
                </Text>
              </View>
              <Switch
                value={formEnabled}
                onValueChange={setFormEnabled}
                trackColor={{ false: Colors.border, true: Colors.neonBlue }}
                thumbColor={Colors.white}
              />
            </View>

            {!!formError && (
              <View style={s.inlineError}>
                <AlertTriangle size={13} color={Colors.error} strokeWidth={2} />
                <Text style={s.inlineErrorText}>{formError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.saveBtn, (saving || !formNameEn.trim()) && s.saveBtnDisabled]}
              onPress={saveSection}
              disabled={saving || !formNameEn.trim()}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color={Colors.background} size="small" />
                : <Text style={s.saveBtnText}>{t.save ?? 'Save'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add product modal ── */}
      <Modal
        visible={addProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddProductModal(false)}
      >
        <View style={s.backdrop}>
          <View style={[s.modalCard, s.productModalCard]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t.addProductToSection ?? 'Add Product'}</Text>
              <TouchableOpacity onPress={() => setAddProductModal(false)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={s.searchRow}>
              <Search size={15} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={s.searchInput}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder={t.searchProducts ?? 'Search products...'}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!productSearch && (
                <TouchableOpacity onPress={() => setProductSearch('')} activeOpacity={0.7}>
                  <X size={14} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            {loadingProducts ? (
              <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: Spacing.lg }} />
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(p) => p.id}
                style={s.productList}
                contentContainerStyle={{ gap: 8, paddingBottom: Spacing.md }}
                renderItem={({ item: p }) => {
                  const inSection = alreadyInSection.has(p.id);
                  return (
                    <TouchableOpacity
                      style={[s.productRow, inSection && s.productRowAdded]}
                      onPress={() => { if (!inSection) addProductToSection(p); }}
                      activeOpacity={inSection ? 1 : 0.8}
                    >
                      <Image
                        source={{ uri: getProductImage(p) }}
                        style={s.productThumb}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.productRowName} numberOfLines={1}>
                          {getProductName(p, 'en')}
                        </Text>
                        <Text style={s.productRowPrice}>${p.price.toLocaleString()}</Text>
                      </View>
                      {inSection
                        ? <View style={s.addedBadge}><Text style={s.addedBadgeText}>Added</Text></View>
                        : <Plus size={16} color={Colors.neonBlue} strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={s.emptySubtitle}>No products found</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Delete confirm modal ── */}
      <Modal
        visible={!!deleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <View style={s.backdrop}>
          <View style={s.confirmCard}>
            <View style={s.confirmIconWrap}>
              <Trash2 size={28} color={Colors.error} strokeWidth={1.5} />
            </View>
            <Text style={s.confirmTitle}>{t.deleteSection ?? 'Delete Section?'}</Text>
            <Text style={s.confirmBody}>
              {t.deleteSectionWarning ?? 'This will remove the section and all its product links.'}
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setDeleteConfirm(null)}
                activeOpacity={0.8}
                disabled={deleting}
              >
                <Text style={s.cancelBtnText}>{t.cancel ?? 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.deleteBtn, deleting && { opacity: 0.5 }]}
                onPress={doDeleteSection}
                activeOpacity={0.8}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color={Colors.error} size="small" />
                  : <Text style={s.deleteBtnText}>{t.delete ?? 'Delete'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isMobile) {
    return (
      <AdminMobileLayout title={title}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {content}
        </ScrollView>
      </AdminMobileLayout>
    );
  }

  return (
    <AdminWebLayout title={title} subtitle={subtitle}>
      {content}
    </AdminWebLayout>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section, index, total, language, t, expanded,
  sectionProducts, loadingProducts,
  onToggleExpand, onEdit, onDelete, onToggleEnabled,
  onMoveUp, onMoveDown, onAddProduct, onRemoveProduct,
  onMoveProductUp, onMoveProductDown,
}: {
  section: HomeSection;
  index: number;
  total: number;
  language: string;
  t: any;
  expanded: boolean;
  sectionProducts?: SectionProduct[];
  loadingProducts: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddProduct: () => void;
  onRemoveProduct: (sp: SectionProduct) => void;
  onMoveProductUp: (i: number) => void;
  onMoveProductDown: (i: number) => void;
}) {
  const displayName = language === 'ar' && section.name_ar ? section.name_ar : section.name_en;
  const altName = displayName === section.name_en ? section.name_ar : section.name_en;

  return (
    <View style={c.card}>
      <View style={c.row}>
        {/* Reorder */}
        <View style={c.reorderCol}>
          <TouchableOpacity
            style={[c.reorderBtn, index === 0 && c.dimmed]}
            onPress={onMoveUp}
            disabled={index === 0}
            activeOpacity={0.7}
          >
            <ChevronUp size={14} color={index === 0 ? Colors.textMuted : Colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.reorderBtn, index === total - 1 && c.dimmed]}
            onPress={onMoveDown}
            disabled={index === total - 1}
            activeOpacity={0.7}
          >
            <ChevronDown size={14} color={index === total - 1 ? Colors.textMuted : Colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Name */}
        <TouchableOpacity style={c.nameCol} onPress={onToggleExpand} activeOpacity={0.8}>
          <View style={c.nameRow}>
            <Text style={c.name}>{displayName}</Text>
            <View style={[c.statusBadge, section.enabled ? c.statusEnabled : c.statusDisabled]}>
              <Text style={[c.statusText, section.enabled ? c.statusTextEnabled : c.statusTextDisabled]}>
                {section.enabled ? (t.sectionEnabled ?? 'Enabled') : (t.sectionDisabled ?? 'Disabled')}
              </Text>
            </View>
          </View>
          {!!altName && <Text style={c.altName}>{altName}</Text>}
          <Text style={c.productCount}>
            {sectionProducts !== undefined
              ? `${sectionProducts.length} product${sectionProducts.length === 1 ? '' : 's'}`
              : 'Tap to manage products'}
          </Text>
        </TouchableOpacity>

        {/* Actions */}
        <View style={c.actions}>
          <Switch
            value={section.enabled}
            onValueChange={onToggleEnabled}
            trackColor={{ false: Colors.border, true: Colors.neonBlue }}
            thumbColor={Colors.white}
            style={c.switch}
          />
          <TouchableOpacity style={c.iconBtn} onPress={onEdit} activeOpacity={0.7}>
            <Pencil size={14} color={Colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={[c.iconBtn, c.iconBtnRed]} onPress={onDelete} activeOpacity={0.7}>
            <Trash2 size={14} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggleExpand} activeOpacity={0.7} style={c.chevronBtn}>
            {expanded
              ? <ChevronUp size={16} color={Colors.neonBlue} strokeWidth={2.5} />
              : <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded products panel */}
      {expanded && (
        <View style={c.productsPanel}>
          <View style={c.productsPanelHeader}>
            <Text style={c.productsPanelTitle}>
              {t.sectionProducts ?? 'Products in Section'}
              {sectionProducts !== undefined && ` (${sectionProducts.length})`}
            </Text>
            <TouchableOpacity style={c.addProductBtn} onPress={onAddProduct} activeOpacity={0.8}>
              <Plus size={13} color={Colors.background} strokeWidth={2.5} />
              <Text style={c.addProductBtnText}>{t.addProductToSection ?? 'Add Product'}</Text>
            </TouchableOpacity>
          </View>

          {loadingProducts && (
            <ActivityIndicator color={Colors.neonBlue} style={{ marginVertical: Spacing.md }} />
          )}

          {!loadingProducts && sectionProducts && sectionProducts.length === 0 && (
            <View style={c.noProducts}>
              <Text style={c.noProductsText}>{t.noProductsInSection ?? 'No products in this section'}</Text>
              <TouchableOpacity style={c.noProductsBtn} onPress={onAddProduct} activeOpacity={0.8}>
                <Plus size={14} color={Colors.neonBlue} strokeWidth={2.5} />
                <Text style={c.noProductsBtnText}>{t.addProductToSection ?? 'Add Product'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loadingProducts && sectionProducts && sectionProducts.length > 0 && (
            <View style={c.productItems}>
              {sectionProducts.map((sp, spIdx) => (
                <SectionProductRow
                  key={sp.id}
                  sp={sp}
                  index={spIdx}
                  total={sectionProducts.length}
                  language={language}
                  onRemove={() => onRemoveProduct(sp)}
                  onMoveUp={() => onMoveProductUp(spIdx)}
                  onMoveDown={() => onMoveProductDown(spIdx)}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SectionProductRow({
  sp, index, total, language, onRemove, onMoveUp, onMoveDown,
}: {
  sp: SectionProduct;
  index: number;
  total: number;
  language: string;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const product = sp.product;
  return (
    <View style={c.productItem}>
      <View style={c.productReorder}>
        <TouchableOpacity
          style={[c.reorderBtn, index === 0 && c.dimmed]}
          onPress={onMoveUp}
          disabled={index === 0}
          activeOpacity={0.7}
        >
          <ChevronUp size={11} color={index === 0 ? Colors.textMuted : Colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[c.reorderBtn, index === total - 1 && c.dimmed]}
          onPress={onMoveDown}
          disabled={index === total - 1}
          activeOpacity={0.7}
        >
          <ChevronDown size={11} color={index === total - 1 ? Colors.textMuted : Colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Image
        source={{ uri: product ? getProductImage(product) : undefined }}
        style={c.productItemThumb}
        resizeMode="cover"
      />

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={c.productItemName} numberOfLines={1}>
          {product ? getProductName(product, language) : sp.product_id.slice(0, 12) + '...'}
        </Text>
        {product && <Text style={c.productItemPrice}>${product.price.toLocaleString()}</Text>}
      </View>

      <TouchableOpacity onPress={onRemove} activeOpacity={0.7} style={c.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <X size={14} color={Colors.error} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Guarded export ───────────────────────────────────────────────────────────

export default function AdminSectionsScreen() {
  return (
    <AdminGuard permission="manage_cms">
      <SectionsScreen />
    </AdminGuard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pageHeading: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  pageSubheading: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    padding: Spacing.md,
  },
  errorBannerText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  retryBtnText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: Spacing.sm,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyAddBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  toast: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D2B1A',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.35)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  // Modal shared
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  productModalCard: {
    maxWidth: 520,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  fieldInputError: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(255,68,68,0.08)',
  },
  fieldInputRTL: {
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
  },
  inlineErrorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
  },
  productList: {
    maxHeight: 380,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  productRowAdded: {
    borderColor: 'rgba(0,230,118,0.3)',
    backgroundColor: 'rgba(0,230,118,0.04)',
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundCard,
  },
  productRowName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  productRowPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  addedBadge: {
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.3)',
  },
  addedBadgeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  confirmBody: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.4)',
  },
  deleteBtnText: {
    color: Colors.error,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});

const c = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  reorderCol: {
    gap: 2,
    alignItems: 'center',
  },
  reorderBtn: {
    width: 26,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimmed: {
    opacity: 0.25,
  },
  nameCol: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  altName: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  productCount: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusEnabled: {
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderColor: 'rgba(0,230,118,0.3)',
  },
  statusDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: Colors.border,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  statusTextEnabled: {
    color: Colors.success,
  },
  statusTextDisabled: {
    color: Colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBtnRed: {
    borderColor: 'rgba(255,68,68,0.3)',
    backgroundColor: 'rgba(255,68,68,0.06)',
  },
  chevronBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productsPanel: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  productsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productsPanelTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  addProductBtnText: {
    color: Colors.background,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  noProducts: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  noProductsText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  noProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noProductsBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  productItems: {
    gap: 6,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  productReorder: {
    gap: 0,
    alignItems: 'center',
  },
  productItemThumb: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  productItemName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  productItemPrice: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  removeBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
