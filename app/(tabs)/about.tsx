import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Instagram,
  Facebook,
  MessageCircle,
  Mail,
  Phone,
  Package,
  RotateCcw,
  ChevronRight,
  Music2,
} from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useTheme, useThemeColors } from '@/context/ThemeContext';

const LOGO_DARK = require('../../assets/images/logo.png');
const LOGO_LIGHT = require('../../assets/images/skydiver-logo-light.png');

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionMap = Record<string, string>;
type AboutData = Record<string, SectionMap>;

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAboutContent(language: string): Promise<AboutData> {
  const [langRes, enRes] = await Promise.all([
    supabase.from('about_content').select('section, key, value').eq('language', language),
    language !== 'en'
      ? supabase.from('about_content').select('section, key, value').eq('language', 'en')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const build = (rows: any[]): AboutData => {
    const map: AboutData = {};
    for (const row of rows ?? []) {
      if (!map[row.section]) map[row.section] = {};
      if (row.value !== null && row.value !== undefined) map[row.section][row.key] = row.value;
    }
    return map;
  };

  const enData = build((enRes as any).data ?? []);
  const langData = build(langRes.data ?? []);

  const merged: AboutData = {};
  const allSections = new Set([...Object.keys(enData), ...Object.keys(langData)]);
  allSections.forEach((section) => {
    merged[section] = { ...(enData[section] ?? {}), ...(langData[section] ?? {}) };
  });
  return merged;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const { language, t } = useLanguage();
  const { branding } = useCMS();
  const C = useThemeColors();
  const { preset } = useTheme();
  const isLight = preset === 'light';
  const LOGO = isLight ? LOGO_LIGHT : LOGO_DARK;

  const [data, setData] = useState<AboutData>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAboutContent(language);
    setData(result);
    setLoading(false);
  }, [language]);

  useEffect(() => { load(); }, [load]);

  const brand = data.brand ?? {};
  const social = data.social ?? {};
  const contact = data.contact ?? {};
  const shipping = data.shipping ?? {};
  const ret = data.return ?? {};
  const footer = data.footer ?? {};

  const brandName = brand.name || branding.app_name || 'SKYDIVER MAN GEAR';
  const brandTagline = brand.tagline || t.aboutTagline;
  const brandDesc = brand.description || '';
  const brandMission = brand.mission || '';

  const whatsappNumber = contact.whatsapp || '';
  const contactEmail = contact.email || '';
  const contactPhone = contact.phone || '';

  const instagramUrl = social.instagram_url || 'https://www.instagram.com';
  const instagramHandle = social.instagram_handle || '@brand';
  const tiktokUrl = social.tiktok_url || 'https://www.tiktok.com';
  const tiktokHandle = social.tiktok_handle || '@brand';
  const facebookUrl = social.facebook_url || 'https://www.facebook.com';
  const facebookHandle = social.facebook_handle || 'Brand';

  const copyright = footer.copyright || `© ${new Date().getFullYear()} ${brandName}`;

  function openUrl(url: string) {
    if (!url) return;
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  }

  function openWhatsApp() {
    if (!whatsappNumber) return;
    const digits = whatsappNumber.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
  }

  // Theme-aware derived values
  const heroBg1 = isLight ? C.background : '#020810';
  const heroBg2 = isLight ? C.backgroundSecondary : '#050D1A';
  const heroBg3 = isLight ? C.background : '#050A14';
  const logoRingBg = isLight ? C.backgroundSecondary : '#060F1E';
  const logoRingBorder = isLight ? C.neonBlueBorder : 'rgba(0,191,255,0.5)';

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <LinearGradient
        colors={[heroBg1, heroBg2, heroBg3]}
        style={StyleSheet.absoluteFill}
      />
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ── Hero header ── */}
        <View style={s.heroSection}>
          <View style={[s.heroBlobTop, { backgroundColor: C.neonBlueGlow }]} />
          <View style={[s.logoRing, { borderColor: logoRingBorder, backgroundColor: logoRingBg }]}>
            <Image source={LOGO} style={s.logo} resizeMode="contain" />
          </View>
          <Text style={[s.heroTitle, { color: C.textPrimary }]}>{t.aboutUs.toUpperCase()}</Text>
          <Text style={[s.heroTagline, { color: C.neonBlue }]}>{brandTagline}</Text>
          <View style={[s.heroAccentLine, { backgroundColor: C.neonBlue, shadowColor: C.neonBlue }]} />
        </View>

        {loading ? (
          <ActivityIndicator color={C.neonBlue} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Brand info ── */}
            {(brandDesc || brandMission) ? (
              <SectionCard C={C}>
                <Text style={{ color: C.neonBlue, fontSize: 16, fontWeight: '900', letterSpacing: 3, marginBottom: 10 }}>
                  {brandName}
                </Text>
                {brandDesc ? (
                  <Text style={{ color: C.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 14 }}>
                    {brandDesc}
                  </Text>
                ) : null}
                {brandMission ? (
                  <View style={{ backgroundColor: C.neonBlueGlow, borderRadius: 10, borderWidth: 1, borderColor: C.neonBlueBorder, padding: 14, gap: 6 }}>
                    <Text style={{ color: C.neonBlue, fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>
                      {t.missionLabel.toUpperCase()}
                    </Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13, lineHeight: 20 }}>
                      {brandMission}
                    </Text>
                  </View>
                ) : null}
              </SectionCard>
            ) : null}

            {/* ── Social links ── */}
            <SectionCard C={C}>
              <SectionHeading
                icon={<Instagram size={16} color={C.neonBlue} strokeWidth={2} />}
                title={t.followUs}
                C={C}
              />
              <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 14, marginTop: 2 }}>
                {t.followSub}
              </Text>

              <SocialButton
                label="Instagram"
                handle={instagramHandle}
                icon={<Instagram size={20} color="#fff" strokeWidth={2} />}
                gradStart="#833AB4"
                gradEnd="#E1306C"
                onPress={() => openUrl(instagramUrl)}
              />
              <SocialButton
                label="TikTok"
                handle={tiktokHandle}
                icon={<Music2 size={20} color="#fff" strokeWidth={2} />}
                gradStart="#010101"
                gradEnd="#69C9D0"
                onPress={() => openUrl(tiktokUrl)}
              />
              <SocialButton
                label="Facebook"
                handle={facebookHandle}
                icon={<Facebook size={20} color="#fff" strokeWidth={2} />}
                gradStart="#1877F2"
                gradEnd="#0D5BBC"
                onPress={() => openUrl(facebookUrl)}
              />
            </SectionCard>

            {/* ── WhatsApp CTA ── */}
            {whatsappNumber ? (
              <TouchableOpacity
                style={s.whatsappBtn}
                onPress={openWhatsApp}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#128C7E', '#25D366']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.whatsappGradient}
                >
                  <MessageCircle size={24} color="#fff" strokeWidth={2.5} />
                  <Text style={s.whatsappText}>{t.contactWhatsapp}</Text>
                  <ChevronRight size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {/* ── Email / Phone ── */}
            {(contactEmail || contactPhone) ? (
              <SectionCard C={C}>
                {contactEmail ? (
                  <ContactRow
                    icon={<Mail size={18} color={C.neonBlue} strokeWidth={2} />}
                    label={t.contactEmail}
                    value={contactEmail}
                    onPress={() => Linking.openURL(`mailto:${contactEmail}`).catch(() => {})}
                    C={C}
                  />
                ) : null}
                {contactPhone ? (
                  <ContactRow
                    icon={<Phone size={18} color={C.neonBlue} strokeWidth={2} />}
                    label={t.contactPhone}
                    value={contactPhone}
                    onPress={() => Linking.openURL(`tel:${contactPhone}`).catch(() => {})}
                    noBorder
                    C={C}
                  />
                ) : null}
              </SectionCard>
            ) : null}

            {/* ── Shipping policy ── */}
            {(shipping.delivery || shipping.areas || shipping.cost) ? (
              <SectionCard C={C}>
                <SectionHeading
                  icon={<Package size={16} color={C.neonBlue} strokeWidth={2} />}
                  title={shipping.title || t.shippingPolicy}
                  C={C}
                />
                <PolicyRow label={t.deliveryTime} value={shipping.delivery} C={C} />
                <PolicyRow label={t.shippingAreas} value={shipping.areas} C={C} />
                <PolicyRow label={t.shippingCost} value={shipping.cost} C={C} />
              </SectionCard>
            ) : null}

            {/* ── Return policy ── */}
            {(ret.days || ret.conditions || ret.refund) ? (
              <SectionCard C={C}>
                <SectionHeading
                  icon={<RotateCcw size={16} color={C.neonBlue} strokeWidth={2} />}
                  title={ret.title || t.returnPolicy}
                  C={C}
                />
                <PolicyRow label={t.returnDays} value={ret.days} C={C} />
                <PolicyRow label={t.returnConditions} value={ret.conditions} C={C} />
                <PolicyRow label={t.returnRefund} value={ret.refund} C={C} />
              </SectionCard>
            ) : null}

            {/* ── Footer ── */}
            <View style={s.footer}>
              <Image source={LOGO} style={s.footerLogo} resizeMode="contain" />
              <Text style={{ color: C.textMuted, fontSize: 11, textAlign: 'center' }}>{copyright}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children, C }: { children: React.ReactNode; C: any }) {
  return (
    <View style={[s.card, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
      {children}
    </View>
  );
}

function SectionHeading({ icon, title, C }: { icon: React.ReactNode; title: string; C: any }) {
  return (
    <View style={s.sectionHeadingRow}>
      <View style={[s.sectionHeadingIcon, { backgroundColor: C.neonBlueGlow }]}>{icon}</View>
      <Text style={[s.sectionHeadingText, { color: C.textPrimary }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

function PolicyRow({ label, value, C }: { label: string; value: string; C: any }) {
  if (!value) return null;
  return (
    <View style={[s.policyRow, { borderBottomColor: C.borderLight }]}>
      <Text style={{ color: C.neonBlue, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: C.textSecondary, fontSize: 13, lineHeight: 20 }}>{value}</Text>
    </View>
  );
}

// ─── Social button ────────────────────────────────────────────────────────────

function SocialButton({
  label, handle, icon, gradStart, gradEnd, onPress,
}: {
  label: string;
  handle: string;
  icon: React.ReactNode;
  gradStart: string;
  gradEnd: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.socialBtn} onPress={onPress} activeOpacity={0.82}>
      <LinearGradient
        colors={[gradStart, gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.socialGradient}
      >
        <View style={s.socialIconCircle}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 }}>{label}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>{handle}</Text>
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({
  icon, label, value, onPress, noBorder, C,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
  noBorder?: boolean;
  C: any;
}) {
  return (
    <TouchableOpacity
      style={[s.contactRow, !noBorder && { borderBottomWidth: 1, borderBottomColor: C.borderLight }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[s.contactIcon, { backgroundColor: C.neonBlueGlow }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 2 }}>{label}</Text>
        <Text style={{ color: C.textPrimary, fontSize: 14, fontWeight: '600' }}>{value}</Text>
      </View>
      <ChevronRight size={16} color={C.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// ─── Static styles (layout-only, no colors) ───────────────────────────────────

const s = StyleSheet.create({
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBlobTop: {
    position: 'absolute',
    top: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 80,
  },
  logoRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 18,
    overflow: 'hidden',
  },
  logo: {
    width: 92,
    height: 92,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
  },
  heroTagline: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 300,
    opacity: 0.85,
  },
  heroAccentLine: {
    width: 48,
    height: 2,
    borderRadius: 1,
    marginTop: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  card: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeadingIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeadingText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  socialBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  socialGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 13,
  },
  socialIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappBtn: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  whatsappGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  whatsappText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 3,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
    gap: 8,
  },
  footerLogo: {
    width: 48,
    height: 48,
    opacity: 0.4,
  },
});
