import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Plus, Pencil, Trash2, X, Truck, Percent, DollarSign, Globe, MapPin, Package, ChevronDown, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { supabase, adminSupabase } from '@/lib/supabase';
import { ShippingRule, TaxRule, getContinent } from '@/lib/shippingTax';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTINENTS = [
  'Africa', 'Asia', 'Europe', 'North America',
  'Oceania', 'South America', 'Antarctica',
];

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bangladesh','Belarus','Belgium','Bolivia','Brazil','Bulgaria',
  'Cambodia','Canada','Chile','China','Colombia','Costa Rica','Croatia',
  'Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','Estonia',
  'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala',
  'Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Latvia','Lebanon',
  'Lithuania','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria',
  'Norway','Pakistan','Panama','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Saudi Arabia','Senegal','Serbia','Singapore','Slovakia',
  'Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Taiwan','Thailand','Turkey','UAE','Ukraine','United Kingdom',
  'United States','Uruguay','Uzbekistan','Venezuela','Vietnam',
];

const EMPTY_SHIPPING: Omit<ShippingRule, 'id'> = {
  name: '',
  scope: 'country',
  region: '',
  shipping_type: 'fixed',
  value: 0,
  free_threshold: null,
  is_enabled: true,
};

const EMPTY_TAX: Omit<TaxRule, 'id'> = {
  country: '',
  tax_percentage: 0,
  tax_label: 'VAT',
  is_enabled: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shippingTypeIcon(type: string) {
  if (type === 'free') return <Package size={13} color={Colors.success} strokeWidth={2} />;
  if (type === 'percentage') return <Percent size={13} color={Colors.neonBlue} strokeWidth={2} />;
  return <DollarSign size={13} color={Colors.warning} strokeWidth={2} />;
}

function shippingTypeLabel(r: ShippingRule) {
  if (r.shipping_type === 'free') return 'Free';
  if (r.shipping_type === 'percentage') return `${r.value}%`;
  return `$${Number(r.value).toFixed(2)}`;
}

// ─── Select Dropdown ──────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={sf.wrapper}>
      <Text style={sf.label}>{label}</Text>
      <TouchableOpacity
        style={sf.trigger}
        onPress={() => { setOpen(true); setSearch(''); }}
        activeOpacity={0.8}
      >
        <Text style={[sf.triggerText, !value && { color: Colors.textMuted }]}>
          {value || 'Select...'}
        </Text>
        <ChevronDown size={15} color={Colors.textMuted} strokeWidth={2} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={sf.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={sf.dropdown}>
          <View style={sf.searchRow}>
            <TextInput
              style={sf.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search..."
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <TouchableOpacity onPress={() => setOpen(false)}>
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={sf.optionList} keyboardShouldPersistTaps="handled">
            {filtered.map((o) => (
              <TouchableOpacity
                key={o}
                style={[sf.option, o === value && sf.optionActive]}
                onPress={() => { onChange(o); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[sf.optionText, o === value && sf.optionTextActive]}>{o}</Text>
                {o === value && <CheckCircle size={14} color={Colors.neonBlue} strokeWidth={2} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const sf = StyleSheet.create({
  wrapper: { gap: 4, marginBottom: Spacing.sm },
  label: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.backgroundInput, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  triggerText: { color: Colors.textPrimary, fontSize: FontSize.md, flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  dropdown: {
    position: 'absolute', top: '50%', left: '50%',
    transform: [{ translateX: -150 }, { translateY: -200 }],
    width: 300, maxHeight: 420,
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.5)' } as any : {}),
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, padding: 0 },
  optionList: { maxHeight: 340 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  optionActive: { backgroundColor: Colors.neonBlueGlow },
  optionText: { color: Colors.textSecondary, fontSize: FontSize.md },
  optionTextActive: { color: Colors.neonBlue, fontWeight: '700' },
});

// ─── Main Content ─────────────────────────────────────────────────────────────

function ShippingTaxContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'shipping' | 'tax'>('shipping');

  // Shipping
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [loadingShipping, setLoadingShipping] = useState(true);
  const [shippingModal, setShippingModal] = useState(false);
  const [editingShipping, setEditingShipping] = useState<ShippingRule | null>(null);
  const [shippingForm, setShippingForm] = useState<Omit<ShippingRule, 'id'>>(EMPTY_SHIPPING);
  const [savingShipping, setSavingShipping] = useState(false);
  const [deleteShippingId, setDeleteShippingId] = useState<string | null>(null);

  // Tax
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [loadingTax, setLoadingTax] = useState(true);
  const [taxModal, setTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRule | null>(null);
  const [taxForm, setTaxForm] = useState<Omit<TaxRule, 'id'>>(EMPTY_TAX);
  const [savingTax, setSavingTax] = useState(false);
  const [deleteTaxId, setDeleteTaxId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchShipping();
    fetchTax();
  }, []);

  // ── Shipping CRUD ──────────────────────────────────────────────────────────

  const fetchShipping = async () => {
    setLoadingShipping(true);
    const { data } = await supabase
      .from('shipping_rules')
      .select('*')
      .order('created_at', { ascending: false });
    setShippingRules((data ?? []) as ShippingRule[]);
    setLoadingShipping(false);
  };

  const openAddShipping = () => {
    setEditingShipping(null);
    setShippingForm(EMPTY_SHIPPING);
    setShippingModal(true);
  };

  const openEditShipping = (r: ShippingRule) => {
    setEditingShipping(r);
    setShippingForm({
      name: r.name,
      scope: r.scope,
      region: r.region,
      shipping_type: r.shipping_type,
      value: r.value,
      free_threshold: r.free_threshold,
      is_enabled: r.is_enabled,
    });
    setShippingModal(true);
  };

  const saveShipping = async () => {
    if (!shippingForm.name.trim()) { showToast('Rule name is required', 'error'); return; }
    if (!shippingForm.region) { showToast('Please select a region', 'error'); return; }
    if (shippingForm.shipping_type !== 'free' && Number(shippingForm.value) <= 0) {
      showToast('Value must be greater than 0', 'error'); return;
    }
    setSavingShipping(true);
    const payload = {
      name: shippingForm.name.trim(),
      scope: shippingForm.scope,
      region: shippingForm.region,
      shipping_type: shippingForm.shipping_type,
      value: Number(shippingForm.value) || 0,
      free_threshold: shippingForm.free_threshold != null ? Number(shippingForm.free_threshold) : null,
      is_enabled: shippingForm.is_enabled,
    };
    const db = adminSupabase();
    if (editingShipping) {
      const { error } = await db.from('shipping_rules').update(payload).eq('id', editingShipping.id);
      if (error) { showToast(error.message, 'error'); setSavingShipping(false); return; }
      showToast('Shipping rule updated');
    } else {
      const duplicate = shippingRules.find(
        (r) => r.scope === payload.scope && r.region === payload.region
      );
      if (duplicate) { showToast(`A rule for "${payload.region}" already exists`, 'error'); setSavingShipping(false); return; }
      const { error } = await db.from('shipping_rules').insert(payload);
      if (error) { showToast(error.message, 'error'); setSavingShipping(false); return; }
      showToast('Shipping rule created');
    }
    setSavingShipping(false);
    setShippingModal(false);
    fetchShipping();
  };

  const toggleShipping = async (id: string, enabled: boolean) => {
    setShippingRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_enabled: enabled } : r)));
    const { error } = await adminSupabase().from('shipping_rules').update({ is_enabled: enabled }).eq('id', id);
    if (error) {
      setShippingRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_enabled: !enabled } : r)));
      showToast(error.message, 'error');
    }
  };

  const deleteShipping = async (id: string) => {
    const { error } = await adminSupabase().from('shipping_rules').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    setDeleteShippingId(null);
    showToast('Rule deleted');
    fetchShipping();
  };

  // ── Tax CRUD ───────────────────────────────────────────────────────────────

  const fetchTax = async () => {
    setLoadingTax(true);
    const { data } = await supabase
      .from('tax_rules')
      .select('*')
      .order('created_at', { ascending: false });
    setTaxRules((data ?? []) as TaxRule[]);
    setLoadingTax(false);
  };

  const openAddTax = () => {
    setEditingTax(null);
    setTaxForm(EMPTY_TAX);
    setTaxModal(true);
  };

  const openEditTax = (r: TaxRule) => {
    setEditingTax(r);
    setTaxForm({
      country: r.country,
      tax_percentage: r.tax_percentage,
      tax_label: r.tax_label,
      is_enabled: r.is_enabled,
    });
    setTaxModal(true);
  };

  const saveTax = async () => {
    if (!taxForm.country) { showToast('Please select a country', 'error'); return; }
    if (!taxForm.tax_label.trim()) { showToast('Tax label is required', 'error'); return; }
    const pct = Number(taxForm.tax_percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showToast('Tax percentage must be between 0 and 100', 'error'); return;
    }
    setSavingTax(true);
    const payload = {
      country: taxForm.country,
      tax_percentage: pct,
      tax_label: taxForm.tax_label.trim(),
      is_enabled: taxForm.is_enabled,
    };
    const db = adminSupabase();
    if (editingTax) {
      const { error } = await db.from('tax_rules').update(payload).eq('id', editingTax.id);
      if (error) { showToast(error.message, 'error'); setSavingTax(false); return; }
      showToast('Tax rule updated');
    } else {
      const duplicate = taxRules.find((r) => r.country === payload.country);
      if (duplicate) { showToast(`A tax rule for "${payload.country}" already exists`, 'error'); setSavingTax(false); return; }
      const { error } = await db.from('tax_rules').insert(payload);
      if (error) { showToast(error.message, 'error'); setSavingTax(false); return; }
      showToast('Tax rule created');
    }
    setSavingTax(false);
    setTaxModal(false);
    fetchTax();
  };

  const toggleTax = async (id: string, enabled: boolean) => {
    setTaxRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_enabled: enabled } : r)));
    const { error } = await adminSupabase().from('tax_rules').update({ is_enabled: enabled }).eq('id', id);
    if (error) {
      setTaxRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_enabled: !enabled } : r)));
      showToast(error.message, 'error');
    }
  };

  const deleteTax = async (id: string) => {
    const { error } = await adminSupabase().from('tax_rules').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    setDeleteTaxId(null);
    showToast('Tax rule deleted');
    fetchTax();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shipping' && styles.tabActive]}
          onPress={() => setActiveTab('shipping')}
          activeOpacity={0.8}
        >
          <Truck size={15} color={activeTab === 'shipping' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'shipping' && styles.tabTextActive]}>
            Shipping Rules
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tax' && styles.tabActive]}
          onPress={() => setActiveTab('tax')}
          activeOpacity={0.8}
        >
          <Percent size={15} color={activeTab === 'tax' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'tax' && styles.tabTextActive]}>
            Tax Rules
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Shipping tab ── */}
      {activeTab === 'shipping' && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shipping Rules</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAddShipping} activeOpacity={0.8}>
              <Plus size={15} color={Colors.background} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Add Rule</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Country rules have priority over continent rules. Disabled rules are ignored.
              If no rule matches, shipping is free.
            </Text>
          </View>

          {loadingShipping ? (
            <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 32 }} />
          ) : shippingRules.length === 0 ? (
            <View style={styles.emptyState}>
              <Truck size={40} color={Colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No shipping rules</Text>
              <Text style={styles.emptySubtitle}>Add rules to control shipping costs by region.</Text>
            </View>
          ) : (
            shippingRules.map((rule) => (
              <View key={rule.id} style={[styles.ruleCard, !rule.is_enabled && styles.ruleCardDisabled]}>
                <View style={styles.ruleCardLeft}>
                  <View style={styles.ruleNameRow}>
                    {shippingTypeIcon(rule.shipping_type)}
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    <View style={[styles.scopeBadge, rule.scope === 'continent' ? styles.scopeBadgeContinent : styles.scopeBadgeCountry]}>
                      <Text style={styles.scopeBadgeText}>{rule.scope}</Text>
                    </View>
                  </View>
                  <Text style={styles.ruleRegion}>
                    {rule.scope === 'continent' ? '🌍' : '📍'} {rule.region}
                    {getContinent(rule.region) && rule.scope === 'country' ? ` · ${getContinent(rule.region)}` : ''}
                  </Text>
                  <View style={styles.ruleMetaRow}>
                    <Text style={styles.ruleMeta}>
                      {rule.shipping_type === 'free'
                        ? 'Free shipping'
                        : rule.shipping_type === 'percentage'
                        ? `${rule.value}% of order`
                        : `$${Number(rule.value).toFixed(2)} flat`}
                    </Text>
                    {rule.free_threshold != null && (
                      <Text style={styles.ruleThreshold}>
                        · Free over ${Number(rule.free_threshold).toFixed(0)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.ruleCardRight}>
                  <Switch
                    value={rule.is_enabled}
                    onValueChange={(v) => toggleShipping(rule.id, v)}
                    thumbColor={rule.is_enabled ? Colors.neonBlue : Colors.textMuted}
                    trackColor={{ false: Colors.border, true: Colors.neonBlueBorder }}
                  />
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openEditShipping(rule)}
                    activeOpacity={0.7}
                  >
                    <Pencil size={15} color={Colors.neonBlue} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setDeleteShippingId(rule.id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color={Colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      )}

      {/* ── Tax tab ── */}
      {activeTab === 'tax' && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tax Rules</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAddTax} activeOpacity={0.8}>
              <Plus size={15} color={Colors.background} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Add Rule</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Tax is applied per country on (subtotal + shipping). If no rule matches the customer's
              country, no tax is charged.
            </Text>
          </View>

          {loadingTax ? (
            <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 32 }} />
          ) : taxRules.length === 0 ? (
            <View style={styles.emptyState}>
              <Percent size={40} color={Colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No tax rules</Text>
              <Text style={styles.emptySubtitle}>Add tax rules per country (e.g. VAT, Sales Tax).</Text>
            </View>
          ) : (
            taxRules.map((rule) => (
              <View key={rule.id} style={[styles.ruleCard, !rule.is_enabled && styles.ruleCardDisabled]}>
                <View style={styles.ruleCardLeft}>
                  <View style={styles.ruleNameRow}>
                    <Percent size={13} color={Colors.warning} strokeWidth={2} />
                    <Text style={styles.ruleName}>{rule.tax_label}</Text>
                    <View style={[styles.scopeBadge, styles.scopeBadgeCountry]}>
                      <Text style={styles.scopeBadgeText}>{rule.tax_percentage}%</Text>
                    </View>
                  </View>
                  <Text style={styles.ruleRegion}>📍 {rule.country}</Text>
                </View>
                <View style={styles.ruleCardRight}>
                  <Switch
                    value={rule.is_enabled}
                    onValueChange={(v) => toggleTax(rule.id, v)}
                    thumbColor={rule.is_enabled ? Colors.neonBlue : Colors.textMuted}
                    trackColor={{ false: Colors.border, true: Colors.neonBlueBorder }}
                  />
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openEditTax(rule)}
                    activeOpacity={0.7}
                  >
                    <Pencil size={15} color={Colors.neonBlue} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setDeleteTaxId(rule.id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color={Colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      )}

      {/* ── Shipping modal ── */}
      <Modal visible={shippingModal} transparent animationType="fade" onRequestClose={() => setShippingModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingShipping ? 'Edit Shipping Rule' : 'Add Shipping Rule'}
              </Text>
              <TouchableOpacity onPress={() => setShippingModal(false)}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <FormField
                label="Rule Name *"
                value={shippingForm.name}
                onChangeText={(v) => setShippingForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. US Standard Shipping"
              />

              {/* Scope toggle */}
              <Text style={styles.fieldLabel}>Scope</Text>
              <View style={styles.segmentRow}>
                {(['country', 'continent'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.segment, shippingForm.scope === s && styles.segmentActive]}
                    onPress={() => setShippingForm((f) => ({ ...f, scope: s, region: '' }))}
                    activeOpacity={0.8}
                  >
                    {s === 'country'
                      ? <MapPin size={13} color={shippingForm.scope === s ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                      : <Globe size={13} color={shippingForm.scope === s ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                    }
                    <Text style={[styles.segmentText, shippingForm.scope === s && styles.segmentTextActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <SelectField
                label={shippingForm.scope === 'country' ? 'Country *' : 'Continent *'}
                value={shippingForm.region}
                options={shippingForm.scope === 'country' ? COUNTRIES : CONTINENTS}
                onChange={(v) => setShippingForm((f) => ({ ...f, region: v }))}
              />

              {/* Shipping type */}
              <Text style={styles.fieldLabel}>Shipping Type</Text>
              <View style={styles.segmentRow}>
                {(['fixed', 'percentage', 'free'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.segment, shippingForm.shipping_type === s && styles.segmentActive]}
                    onPress={() => setShippingForm((f) => ({ ...f, shipping_type: s }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, shippingForm.shipping_type === s && styles.segmentTextActive]}>
                      {s === 'fixed' ? 'Fixed $' : s === 'percentage' ? 'Percentage %' : 'Free'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {shippingForm.shipping_type !== 'free' && (
                <FormField
                  label={shippingForm.shipping_type === 'fixed' ? 'Amount ($) *' : 'Percentage (%) *'}
                  value={String(shippingForm.value || '')}
                  onChangeText={(v) => setShippingForm((f) => ({ ...f, value: Number(v) || 0 }))}
                  placeholder={shippingForm.shipping_type === 'fixed' ? '9.99' : '10'}
                  keyboardType="decimal-pad"
                />
              )}

              <FormField
                label="Free Shipping Threshold (optional, $)"
                value={shippingForm.free_threshold != null ? String(shippingForm.free_threshold) : ''}
                onChangeText={(v) => setShippingForm((f) => ({ ...f, free_threshold: v.trim() === '' ? null : Number(v) }))}
                placeholder="e.g. 200 — free if order ≥ $200"
                keyboardType="decimal-pad"
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Enabled</Text>
                <Switch
                  value={shippingForm.is_enabled}
                  onValueChange={(v) => setShippingForm((f) => ({ ...f, is_enabled: v }))}
                  thumbColor={shippingForm.is_enabled ? Colors.neonBlue : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.neonBlueBorder }}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, savingShipping && { opacity: 0.6 }]}
                onPress={saveShipping}
                disabled={savingShipping}
                activeOpacity={0.8}
              >
                {savingShipping
                  ? <ActivityIndicator color={Colors.background} size="small" />
                  : <Text style={styles.saveBtnText}>{editingShipping ? 'Update Rule' : 'Add Rule'}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Tax modal ── */}
      <Modal visible={taxModal} transparent animationType="fade" onRequestClose={() => setTaxModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTax ? 'Edit Tax Rule' : 'Add Tax Rule'}
              </Text>
              <TouchableOpacity onPress={() => setTaxModal(false)}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <SelectField
                label="Country *"
                value={taxForm.country}
                options={COUNTRIES}
                onChange={(v) => setTaxForm((f) => ({ ...f, country: v }))}
              />
              <FormField
                label="Tax Percentage (%) *"
                value={String(taxForm.tax_percentage || '')}
                onChangeText={(v) => setTaxForm((f) => ({ ...f, tax_percentage: Number(v) || 0 }))}
                placeholder="e.g. 20"
                keyboardType="decimal-pad"
              />
              <FormField
                label="Tax Label *"
                value={taxForm.tax_label}
                onChangeText={(v) => setTaxForm((f) => ({ ...f, tax_label: v }))}
                placeholder="e.g. VAT, Sales Tax, GST"
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Enabled</Text>
                <Switch
                  value={taxForm.is_enabled}
                  onValueChange={(v) => setTaxForm((f) => ({ ...f, is_enabled: v }))}
                  thumbColor={taxForm.is_enabled ? Colors.neonBlue : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.neonBlueBorder }}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, savingTax && { opacity: 0.6 }]}
                onPress={saveTax}
                disabled={savingTax}
                activeOpacity={0.8}
              >
                {savingTax
                  ? <ActivityIndicator color={Colors.background} size="small" />
                  : <Text style={styles.saveBtnText}>{editingTax ? 'Update Rule' : 'Add Rule'}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Confirm delete shipping ── */}
      <Modal visible={!!deleteShippingId} transparent animationType="fade" onRequestClose={() => setDeleteShippingId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete shipping rule?</Text>
            <Text style={styles.confirmBody}>This cannot be undone.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteShippingId(null)} activeOpacity={0.8}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={() => deleteShipping(deleteShippingId!)} activeOpacity={0.8}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Confirm delete tax ── */}
      <Modal visible={!!deleteTaxId} transparent animationType="fade" onRequestClose={() => setDeleteTaxId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete tax rule?</Text>
            <Text style={styles.confirmBody}>This cannot be undone.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteTaxId(null)} activeOpacity={0.8}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={() => deleteTax(deleteTaxId!)} activeOpacity={0.8}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Guards & Dashboard wrappers ──────────────────────────────────────────────

function ShippingTaxWeb() {
  const { t } = useLanguage();
  return (
    <AdminWebDashboard title="Shipping & Tax" subtitle="Manage shipping costs and tax rules by region">
      <ShippingTaxContent />
    </AdminWebDashboard>
  );
}

function ShippingTaxMobile() {
  const { t } = useLanguage();
  return (
    <AdminMobileDashboard title="Shipping & Tax">
      <ShippingTaxContent />
    </AdminMobileDashboard>
  );
}

export default function ShippingTaxScreen() {
  const { isMobile } = useAdminLayout();
  return (
    <AdminGuard>
      {isMobile ? <ShippingTaxMobile /> : <ShippingTaxWeb />}
    </AdminGuard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  tabText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  tabTextActive: { color: Colors.neonBlue },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },
  infoBox: {
    backgroundColor: 'rgba(0,191,255,0.07)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  emptyState: {
    alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xl * 2,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  ruleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  ruleCardDisabled: { opacity: 0.5 },
  ruleCardLeft: { flex: 1, gap: 4 },
  ruleCardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ruleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700', flex: 1 },
  ruleRegion: { color: Colors.textMuted, fontSize: FontSize.xs },
  ruleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ruleMeta: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  ruleThreshold: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '600' },
  scopeBadge: {
    borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1,
  },
  scopeBadgeCountry: { backgroundColor: 'rgba(0,191,255,0.1)', borderColor: Colors.neonBlueBorder },
  scopeBadgeContinent: { backgroundColor: 'rgba(255,179,0,0.1)', borderColor: 'rgba(255,179,0,0.4)' },
  scopeBadgeText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  iconBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundInput, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 500,
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
  formField: { marginBottom: Spacing.md },
  fieldLabel: {
    color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundInput, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.md,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  segment: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundInput,
  },
  segmentActive: { borderColor: Colors.neonBlue, backgroundColor: Colors.neonBlueGlow },
  segmentText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  segmentTextActive: { color: Colors.neonBlue },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md, paddingVertical: 4,
  },
  saveBtn: {
    backgroundColor: Colors.neonBlue, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  // Confirm
  confirmCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm,
    width: 320,
  },
  confirmTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  confirmBody: { color: Colors.textMuted, fontSize: FontSize.sm },
  confirmBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  confirmCancel: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  confirmCancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: FontSize.md },
  confirmDelete: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.error, alignItems: 'center',
  },
  confirmDeleteText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
});
