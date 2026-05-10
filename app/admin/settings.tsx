import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import { Save, Store, Mail, DollarSign, Globe, Share2, Package, Palette, Moon, Sun } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { supabase, adminSupabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { useCMS } from '@/context/CMSContext';
import { useTheme } from '@/context/ThemeContext';
import { Platform } from 'react-native';

type SettingsMap = Record<string, string>;

const SETTING_GROUPS = [
  {
    title: 'Store Identity',
    icon: Store,
    fields: [
      { key: 'store_name', label: 'Store Name', placeholder: 'Skydiver Man Gear' },
      { key: 'store_tagline', label: 'Store Tagline', placeholder: 'Professional Skydiving Equipment' },
      { key: 'logo_url', label: 'Logo URL', placeholder: 'https://...', hint: 'Direct link to your logo image' },
    ],
  },
  {
    title: 'Contact Information',
    icon: Mail,
    fields: [
      { key: 'contact_email', label: 'Contact Email', placeholder: 'hello@yourstore.com', keyboardType: 'email-address' },
      { key: 'contact_phone', label: 'Contact Phone', placeholder: '+1 (800) 000-0000', keyboardType: 'phone-pad' },
      { key: 'contact_address_line1', label: 'Address Line 1', placeholder: '123 Main Street' },
      { key: 'contact_address_line2', label: 'Address Line 2', placeholder: 'Suite 100 (optional)' },
      { key: 'contact_city', label: 'City', placeholder: 'Skydive City' },
      { key: 'contact_state', label: 'State / Province', placeholder: 'CA' },
      { key: 'contact_zip', label: 'ZIP / Postal Code', placeholder: '90210' },
      { key: 'contact_country', label: 'Country', placeholder: 'United States' },
    ],
  },
  {
    title: 'Social Links',
    icon: Share2,
    fields: [
      { key: 'social_instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/...' },
      { key: 'social_facebook', label: 'Facebook URL', placeholder: 'https://facebook.com/...' },
      { key: 'social_twitter', label: 'X / Twitter URL', placeholder: 'https://x.com/...' },
      { key: 'social_youtube', label: 'YouTube URL', placeholder: 'https://youtube.com/...' },
    ],
  },
  {
    title: 'Commerce Settings',
    icon: DollarSign,
    fields: [
      { key: 'currency', label: 'Currency', placeholder: 'USD' },
      { key: 'shipping_free_threshold', label: 'Free Shipping Threshold ($)', placeholder: '150', keyboardType: 'decimal-pad', hint: 'Orders above this amount get free shipping' },
      { key: 'tax_rate', label: 'Tax Rate (%)', placeholder: '8.5', keyboardType: 'decimal-pad', hint: 'Percentage applied at checkout' },
    ],
  },
  {
    title: 'Localization',
    icon: Globe,
    fields: [
      { key: 'language', label: 'Language', placeholder: 'en', hint: 'Language code (e.g., en, es, fr)' },
      { key: 'timezone', label: 'Timezone', placeholder: 'America/New_York', hint: 'IANA timezone (e.g., America/Los_Angeles)' },
      { key: 'date_format', label: 'Date Format', placeholder: 'MM/DD/YYYY' },
    ],
  },
];

const THEME_OPTIONS = [
  {
    value: 'dark',
    label: 'Dark Theme',
    desc: 'Deep navy & neon blue. Default.',
    Icon: Moon,
    bg: '#050A14',
    accent: '#00BFFF',
    text: '#E8F4FD',
  },
  {
    value: 'light',
    label: 'Light Theme',
    desc: 'Clean white & ocean blue.',
    Icon: Sun,
    bg: '#F0F4F8',
    accent: '#0077B6',
    text: '#0D1B2A',
  },
];

function SettingsScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const router = useRouter();
  const { isMobile } = useAdminLayout();
  const { t } = useLanguage();
  const { theme, refresh: refreshCMS } = useCMS();
  const { setThemePreset } = useTheme();

  const groupTitleMap: Record<string, string> = {
    'Store Identity': t.storeIdentityGroup,
    'Contact Information': t.contactInformationGroup,
    'Social Links': t.socialLinksGroup,
    'Commerce Settings': t.commerceSettingsGroup,
    'Localization': t.localizationGroup,
  };

  const fieldLabelMap: Record<string, string> = {
    'Store Name': t.storeName,
    'Store Tagline': t.storeTagline,
    'Logo URL': t.logoUrl,
    'Contact Email': t.supportEmail,
    'Contact Phone': t.supportPhone,
    'Address Line 1': t.address,
    'Address Line 2': t.optional,
    'City': t.city,
    'State / Province': t.state,
    'ZIP / Postal Code': t.zip,
    'Country': t.country,
    'Instagram URL': t.instagramUrl,
    'Facebook URL': t.facebookUrl,
    'X / Twitter URL': t.twitterUrl,
    'YouTube URL': t.youtubeUrl,
    'Currency': t.currencyCode,
    'Free Shipping Threshold ($)': t.freeShippingThreshold,
    'Tax Rate (%)': t.taxRate,
    'Language': t.defaultLanguage,
    'Timezone': t.timezone,
    'Date Format': t.optional,
  };
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activePreset, setActivePreset] = useState<string>(theme?.active_preset ?? 'dark');
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);

  // Sync preset when CMS theme loads
  useEffect(() => {
    if (theme?.active_preset) setActivePreset(theme.active_preset === 'midnight-blue' ? 'dark' : theme.active_preset);
  }, [theme?.active_preset]);

  const handleThemeSave = async (preset: string) => {
    setActivePreset(preset);
    // Apply immediately to the global theme context (updates all screens in real-time).
    setThemePreset(preset);
    setThemeSaving(true);
    const db = adminSupabase();
    await db.from('site_settings').upsert(
      { key: 'theme_active_preset', value: preset, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setThemeSaving(false);
    setThemeSaved(true);
    setTimeout(() => setThemeSaved(false), 2000);
    await refreshCMS();
  };

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchSettings();
  }, [isAdminAuthenticated]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('site_settings').select('*');
    const map: SettingsMap = {};
    (data ?? []).forEach((row: any) => { map[row.key] = row.value; });
    setSettings(map);
    setLoading(false);
  };

  const updateField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const db = adminSupabase();
    for (const [key, value] of Object.entries(settings)) {
      await db
        .from('site_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Shell = isMobile ? AdminMobileDashboard : AdminWebDashboard;

  if (loading) {
    return (
      <Shell title={t.settings} showBack={isMobile}>
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      </Shell>
    );
  }

  return (
    <Shell title={t.settings} showBack={isMobile}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.description}>{t.configureStoreDesc}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : saved ? (
              <Text style={styles.saveBtnText}>{t.savedBang}</Text>
            ) : (
              <>
                <Save size={15} color={Colors.background} strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>{t.save}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Theme Settings ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Palette size={18} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.cardTitle}>Theme Settings</Text>
            {themeSaving && <ActivityIndicator color={Colors.neonBlue} size="small" style={{ marginLeft: 'auto' }} />}
            {themeSaved && !themeSaving && (
              <Text style={[styles.cardTitle, { marginLeft: 'auto', color: Colors.success, fontSize: FontSize.sm }]}>Saved!</Text>
            )}
          </View>
          <Text style={[styles.fieldHint, { marginBottom: Spacing.md }]}>Choose the storefront and dashboard appearance.</Text>
          <View style={themeStyles.row}>
            {THEME_OPTIONS.map((opt) => {
              const selected = activePreset === opt.value;
              const Icon = opt.Icon;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[themeStyles.card, selected && themeStyles.cardSelected]}
                  onPress={() => handleThemeSave(opt.value)}
                  activeOpacity={0.8}
                >
                  {/* Mini preview swatch */}
                  <View style={[themeStyles.swatch, { backgroundColor: opt.bg, borderColor: opt.accent }]}>
                    <View style={[themeStyles.swatchBar, { backgroundColor: opt.accent }]} />
                    <View style={[themeStyles.swatchDot, { backgroundColor: opt.accent }]} />
                    <Icon size={16} color={opt.accent} strokeWidth={2} />
                  </View>
                  <Text style={[themeStyles.label, { color: selected ? Colors.neonBlue : Colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text style={themeStyles.desc}>{opt.desc}</Text>
                  {selected && (
                    <View style={themeStyles.activePill}>
                      <Text style={themeStyles.activePillText}>Active</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {SETTING_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <View key={group.title} style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon size={18} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={styles.cardTitle}>{groupTitleMap[group.title] ?? group.title}</Text>
              </View>
              {group.fields.map((field) => (
                <View key={field.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{fieldLabelMap[field.label] ?? field.label}</Text>
                  {(field as any).hint && <Text style={styles.fieldHint}>{(field as any).hint}</Text>}
                  <TextInput
                    style={styles.input}
                    value={settings[field.key] ?? ''}
                    onChangeText={(v) => updateField(field.key, v)}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={(field as any).keyboardType ?? 'default'}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.dangerCard}>
          <View style={styles.cardHeader}>
            <Package size={18} color={Colors.error} strokeWidth={2} />
            <Text style={[styles.cardTitle, { color: Colors.error }]}>{t.adminInfoGroup}</Text>
          </View>
          <Text style={styles.dangerText}>{t.adminInfoDesc}</Text>
          <View style={styles.credentialsBox}>
            <Text style={styles.credLabel}>{t.defaultLoginCredentials}</Text>
            <Text style={styles.credValue}>Email: admin@skydivermangear.com</Text>
            <Text style={styles.credValue}>Password: admin123</Text>
          </View>
        </View>
      </View>
    </Shell>
  );
}

export default function SettingsScreenGuarded() {
  return (
    <AdminGuard permission="manage_settings">
      <SettingsScreen />
    </AdminGuard>
  );
}

const themeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.backgroundSecondary,
  },
  cardSelected: {
    borderColor: Colors.neonBlue,
    backgroundColor: 'rgba(0,191,255,0.07)',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  swatch: {
    width: '100%',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 2,
  },
  swatchBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.7,
  },
  swatchDot: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.5,
  },
  label: { fontSize: FontSize.sm, fontWeight: '800', letterSpacing: 0.3 },
  desc: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', lineHeight: 14 },
  activePill: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  activePillText: { color: '#050A14', fontSize: FontSize.xs, fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: { paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg, gap: Spacing.md },
  description: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, flexShrink: 0 },
  saveBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  cardTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 4 },
  input: { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.md },
  dangerCard: { backgroundColor: Colors.errorDim, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.error + '33' },
  dangerText: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
  credentialsBox: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  credLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  credValue: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '500', fontFamily: 'monospace' as any },
});
