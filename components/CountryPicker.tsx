import React, {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Modal, Platform, Pressable, KeyboardAvoidingView,
  SafeAreaView, I18nManager,
} from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Country data ──────────────────────────────────────────────────────────────

export type Country = { code: string; en: string; ar: string };

export const COUNTRIES: Country[] = [
  { code: 'AF', en: 'Afghanistan', ar: 'أفغانستان' },
  { code: 'AL', en: 'Albania', ar: 'ألبانيا' },
  { code: 'DZ', en: 'Algeria', ar: 'الجزائر' },
  { code: 'AD', en: 'Andorra', ar: 'أندورا' },
  { code: 'AO', en: 'Angola', ar: 'أنغولا' },
  { code: 'AG', en: 'Antigua and Barbuda', ar: 'أنتيغوا وباربودا' },
  { code: 'AR', en: 'Argentina', ar: 'الأرجنتين' },
  { code: 'AM', en: 'Armenia', ar: 'أرمينيا' },
  { code: 'AU', en: 'Australia', ar: 'أستراليا' },
  { code: 'AT', en: 'Austria', ar: 'النمسا' },
  { code: 'AZ', en: 'Azerbaijan', ar: 'أذربيجان' },
  { code: 'BS', en: 'Bahamas', ar: 'جزر البهاما' },
  { code: 'BH', en: 'Bahrain', ar: 'البحرين' },
  { code: 'BD', en: 'Bangladesh', ar: 'بنغلاديش' },
  { code: 'BB', en: 'Barbados', ar: 'بربادوس' },
  { code: 'BY', en: 'Belarus', ar: 'بيلاروسيا' },
  { code: 'BE', en: 'Belgium', ar: 'بلجيكا' },
  { code: 'BZ', en: 'Belize', ar: 'بليز' },
  { code: 'BJ', en: 'Benin', ar: 'بنين' },
  { code: 'BT', en: 'Bhutan', ar: 'بوتان' },
  { code: 'BO', en: 'Bolivia', ar: 'بوليفيا' },
  { code: 'BA', en: 'Bosnia and Herzegovina', ar: 'البوسنة والهرسك' },
  { code: 'BW', en: 'Botswana', ar: 'بوتسوانا' },
  { code: 'BR', en: 'Brazil', ar: 'البرازيل' },
  { code: 'BN', en: 'Brunei', ar: 'بروناي' },
  { code: 'BG', en: 'Bulgaria', ar: 'بلغاريا' },
  { code: 'BF', en: 'Burkina Faso', ar: 'بوركينا فاسو' },
  { code: 'BI', en: 'Burundi', ar: 'بوروندي' },
  { code: 'CV', en: 'Cape Verde', ar: 'الرأس الأخضر' },
  { code: 'KH', en: 'Cambodia', ar: 'كمبوديا' },
  { code: 'CM', en: 'Cameroon', ar: 'الكاميرون' },
  { code: 'CA', en: 'Canada', ar: 'كندا' },
  { code: 'CF', en: 'Central African Republic', ar: 'جمهورية أفريقيا الوسطى' },
  { code: 'TD', en: 'Chad', ar: 'تشاد' },
  { code: 'CL', en: 'Chile', ar: 'تشيلي' },
  { code: 'CN', en: 'China', ar: 'الصين' },
  { code: 'CO', en: 'Colombia', ar: 'كولومبيا' },
  { code: 'KM', en: 'Comoros', ar: 'جزر القمر' },
  { code: 'CG', en: 'Congo', ar: 'الكونغو' },
  { code: 'CD', en: 'Congo (DRC)', ar: 'جمهورية الكونغو الديمقراطية' },
  { code: 'CR', en: 'Costa Rica', ar: 'كوستاريكا' },
  { code: 'HR', en: 'Croatia', ar: 'كرواتيا' },
  { code: 'CU', en: 'Cuba', ar: 'كوبا' },
  { code: 'CY', en: 'Cyprus', ar: 'قبرص' },
  { code: 'CZ', en: 'Czech Republic', ar: 'جمهورية التشيك' },
  { code: 'DK', en: 'Denmark', ar: 'الدنمارك' },
  { code: 'DJ', en: 'Djibouti', ar: 'جيبوتي' },
  { code: 'DM', en: 'Dominica', ar: 'دومينيكا' },
  { code: 'DO', en: 'Dominican Republic', ar: 'جمهورية الدومينيكان' },
  { code: 'EC', en: 'Ecuador', ar: 'الإكوادور' },
  { code: 'EG', en: 'Egypt', ar: 'مصر' },
  { code: 'SV', en: 'El Salvador', ar: 'السلفادور' },
  { code: 'GQ', en: 'Equatorial Guinea', ar: 'غينيا الاستوائية' },
  { code: 'ER', en: 'Eritrea', ar: 'إريتريا' },
  { code: 'EE', en: 'Estonia', ar: 'إستونيا' },
  { code: 'SZ', en: 'Eswatini', ar: 'إسواتيني' },
  { code: 'ET', en: 'Ethiopia', ar: 'إثيوبيا' },
  { code: 'FJ', en: 'Fiji', ar: 'فيجي' },
  { code: 'FI', en: 'Finland', ar: 'فنلندا' },
  { code: 'FR', en: 'France', ar: 'فرنسا' },
  { code: 'GA', en: 'Gabon', ar: 'الغابون' },
  { code: 'GM', en: 'Gambia', ar: 'غامبيا' },
  { code: 'GE', en: 'Georgia', ar: 'جورجيا' },
  { code: 'DE', en: 'Germany', ar: 'ألمانيا' },
  { code: 'GH', en: 'Ghana', ar: 'غانا' },
  { code: 'GR', en: 'Greece', ar: 'اليونان' },
  { code: 'GD', en: 'Grenada', ar: 'غرينادا' },
  { code: 'GT', en: 'Guatemala', ar: 'غواتيمالا' },
  { code: 'GN', en: 'Guinea', ar: 'غينيا' },
  { code: 'GW', en: 'Guinea-Bissau', ar: 'غينيا بيساو' },
  { code: 'GY', en: 'Guyana', ar: 'غيانا' },
  { code: 'HT', en: 'Haiti', ar: 'هايتي' },
  { code: 'HN', en: 'Honduras', ar: 'هندوراس' },
  { code: 'HU', en: 'Hungary', ar: 'المجر' },
  { code: 'IS', en: 'Iceland', ar: 'آيسلندا' },
  { code: 'IN', en: 'India', ar: 'الهند' },
  { code: 'ID', en: 'Indonesia', ar: 'إندونيسيا' },
  { code: 'IR', en: 'Iran', ar: 'إيران' },
  { code: 'IQ', en: 'Iraq', ar: 'العراق' },
  { code: 'IE', en: 'Ireland', ar: 'أيرلندا' },
  { code: 'IL', en: 'Israel', ar: 'إسرائيل' },
  { code: 'IT', en: 'Italy', ar: 'إيطاليا' },
  { code: 'JM', en: 'Jamaica', ar: 'جامايكا' },
  { code: 'JP', en: 'Japan', ar: 'اليابان' },
  { code: 'JO', en: 'Jordan', ar: 'الأردن' },
  { code: 'KZ', en: 'Kazakhstan', ar: 'كازاخستان' },
  { code: 'KE', en: 'Kenya', ar: 'كينيا' },
  { code: 'KI', en: 'Kiribati', ar: 'كيريباتي' },
  { code: 'KP', en: 'North Korea', ar: 'كوريا الشمالية' },
  { code: 'KR', en: 'South Korea', ar: 'كوريا الجنوبية' },
  { code: 'KW', en: 'Kuwait', ar: 'الكويت' },
  { code: 'KG', en: 'Kyrgyzstan', ar: 'قيرغيزستان' },
  { code: 'LA', en: 'Laos', ar: 'لاوس' },
  { code: 'LV', en: 'Latvia', ar: 'لاتفيا' },
  { code: 'LB', en: 'Lebanon', ar: 'لبنان' },
  { code: 'LS', en: 'Lesotho', ar: 'ليسوتو' },
  { code: 'LR', en: 'Liberia', ar: 'ليبيريا' },
  { code: 'LY', en: 'Libya', ar: 'ليبيا' },
  { code: 'LI', en: 'Liechtenstein', ar: 'ليختنشتاين' },
  { code: 'LT', en: 'Lithuania', ar: 'ليتوانيا' },
  { code: 'LU', en: 'Luxembourg', ar: 'لوكسمبورغ' },
  { code: 'MG', en: 'Madagascar', ar: 'مدغشقر' },
  { code: 'MW', en: 'Malawi', ar: 'ملاوي' },
  { code: 'MY', en: 'Malaysia', ar: 'ماليزيا' },
  { code: 'MV', en: 'Maldives', ar: 'المالديف' },
  { code: 'ML', en: 'Mali', ar: 'مالي' },
  { code: 'MT', en: 'Malta', ar: 'مالطا' },
  { code: 'MH', en: 'Marshall Islands', ar: 'جزر مارشال' },
  { code: 'MR', en: 'Mauritania', ar: 'موريتانيا' },
  { code: 'MU', en: 'Mauritius', ar: 'موريشيوس' },
  { code: 'MX', en: 'Mexico', ar: 'المكسيك' },
  { code: 'FM', en: 'Micronesia', ar: 'ميكرونيزيا' },
  { code: 'MD', en: 'Moldova', ar: 'مولدوفا' },
  { code: 'MC', en: 'Monaco', ar: 'موناكو' },
  { code: 'MN', en: 'Mongolia', ar: 'منغوليا' },
  { code: 'ME', en: 'Montenegro', ar: 'الجبل الأسود' },
  { code: 'MA', en: 'Morocco', ar: 'المغرب' },
  { code: 'MZ', en: 'Mozambique', ar: 'موزمبيق' },
  { code: 'MM', en: 'Myanmar', ar: 'ميانمار' },
  { code: 'NA', en: 'Namibia', ar: 'ناميبيا' },
  { code: 'NR', en: 'Nauru', ar: 'ناورو' },
  { code: 'NP', en: 'Nepal', ar: 'نيبال' },
  { code: 'NL', en: 'Netherlands', ar: 'هولندا' },
  { code: 'NZ', en: 'New Zealand', ar: 'نيوزيلندا' },
  { code: 'NI', en: 'Nicaragua', ar: 'نيكاراغوا' },
  { code: 'NE', en: 'Niger', ar: 'النيجر' },
  { code: 'NG', en: 'Nigeria', ar: 'نيجيريا' },
  { code: 'MK', en: 'North Macedonia', ar: 'مقدونيا الشمالية' },
  { code: 'NO', en: 'Norway', ar: 'النرويج' },
  { code: 'OM', en: 'Oman', ar: 'عُمان' },
  { code: 'PK', en: 'Pakistan', ar: 'باكستان' },
  { code: 'PW', en: 'Palau', ar: 'بالاو' },
  { code: 'PA', en: 'Panama', ar: 'بنما' },
  { code: 'PG', en: 'Papua New Guinea', ar: 'بابوا غينيا الجديدة' },
  { code: 'PY', en: 'Paraguay', ar: 'باراغواي' },
  { code: 'PE', en: 'Peru', ar: 'بيرو' },
  { code: 'PH', en: 'Philippines', ar: 'الفلبين' },
  { code: 'PL', en: 'Poland', ar: 'بولندا' },
  { code: 'PT', en: 'Portugal', ar: 'البرتغال' },
  { code: 'QA', en: 'Qatar', ar: 'قطر' },
  { code: 'RO', en: 'Romania', ar: 'رومانيا' },
  { code: 'RU', en: 'Russia', ar: 'روسيا' },
  { code: 'RW', en: 'Rwanda', ar: 'رواندا' },
  { code: 'KN', en: 'Saint Kitts and Nevis', ar: 'سانت كيتس ونيفيس' },
  { code: 'LC', en: 'Saint Lucia', ar: 'سانت لوسيا' },
  { code: 'VC', en: 'Saint Vincent and the Grenadines', ar: 'سانت فينسنت وجزر غرينادين' },
  { code: 'WS', en: 'Samoa', ar: 'ساموا' },
  { code: 'SM', en: 'San Marino', ar: 'سان مارينو' },
  { code: 'ST', en: 'Sao Tome and Principe', ar: 'ساو تومي وبرينسيبي' },
  { code: 'SA', en: 'Saudi Arabia', ar: 'المملكة العربية السعودية' },
  { code: 'SN', en: 'Senegal', ar: 'السنغال' },
  { code: 'RS', en: 'Serbia', ar: 'صربيا' },
  { code: 'SC', en: 'Seychelles', ar: 'سيشل' },
  { code: 'SL', en: 'Sierra Leone', ar: 'سيراليون' },
  { code: 'SG', en: 'Singapore', ar: 'سنغافورة' },
  { code: 'SK', en: 'Slovakia', ar: 'سلوفاكيا' },
  { code: 'SI', en: 'Slovenia', ar: 'سلوفينيا' },
  { code: 'SB', en: 'Solomon Islands', ar: 'جزر سليمان' },
  { code: 'SO', en: 'Somalia', ar: 'الصومال' },
  { code: 'ZA', en: 'South Africa', ar: 'جنوب أفريقيا' },
  { code: 'SS', en: 'South Sudan', ar: 'جنوب السودان' },
  { code: 'ES', en: 'Spain', ar: 'إسبانيا' },
  { code: 'LK', en: 'Sri Lanka', ar: 'سريلانكا' },
  { code: 'SD', en: 'Sudan', ar: 'السودان' },
  { code: 'SR', en: 'Suriname', ar: 'سورينام' },
  { code: 'SE', en: 'Sweden', ar: 'السويد' },
  { code: 'CH', en: 'Switzerland', ar: 'سويسرا' },
  { code: 'SY', en: 'Syria', ar: 'سوريا' },
  { code: 'TW', en: 'Taiwan', ar: 'تايوان' },
  { code: 'TJ', en: 'Tajikistan', ar: 'طاجيكستان' },
  { code: 'TZ', en: 'Tanzania', ar: 'تنزانيا' },
  { code: 'TH', en: 'Thailand', ar: 'تايلاند' },
  { code: 'TL', en: 'Timor-Leste', ar: 'تيمور الشرقية' },
  { code: 'TG', en: 'Togo', ar: 'توغو' },
  { code: 'TO', en: 'Tonga', ar: 'تونغا' },
  { code: 'TT', en: 'Trinidad and Tobago', ar: 'ترينيداد وتوباغو' },
  { code: 'TN', en: 'Tunisia', ar: 'تونس' },
  { code: 'TR', en: 'Turkey', ar: 'تركيا' },
  { code: 'TM', en: 'Turkmenistan', ar: 'تركمانستان' },
  { code: 'TV', en: 'Tuvalu', ar: 'توفالو' },
  { code: 'UG', en: 'Uganda', ar: 'أوغندا' },
  { code: 'UA', en: 'Ukraine', ar: 'أوكرانيا' },
  { code: 'AE', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
  { code: 'GB', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { code: 'US', en: 'United States', ar: 'الولايات المتحدة الأمريكية' },
  { code: 'UY', en: 'Uruguay', ar: 'أوروغواي' },
  { code: 'UZ', en: 'Uzbekistan', ar: 'أوزبكستان' },
  { code: 'VU', en: 'Vanuatu', ar: 'فانواتو' },
  { code: 'VE', en: 'Venezuela', ar: 'فنزويلا' },
  { code: 'VN', en: 'Vietnam', ar: 'فيتنام' },
  { code: 'YE', en: 'Yemen', ar: 'اليمن' },
  { code: 'ZM', en: 'Zambia', ar: 'زامبيا' },
  { code: 'ZW', en: 'Zimbabwe', ar: 'زيمبابوي' },
];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function getCountryByName(name: string): Country | undefined {
  const lower = name.toLowerCase();
  return COUNTRIES.find(
    (c) => c.en.toLowerCase() === lower || c.ar === name || c.code.toLowerCase() === lower
  );
}

export function getCountryDisplayName(country: Country, language: string): string {
  return language === 'ar' ? country.ar : country.en;
}

// ─── Emoji flag from ISO code ──────────────────────────────────────────────────

export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const offset = 127397;
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + offset,
    code.toUpperCase().charCodeAt(1) + offset,
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  value: string;       // ISO-2 code or ''
  onChange: (code: string, displayName: string) => void;
  language?: string;
  label?: string;
  error?: string;
  style?: object;
  placeholder?: string;
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function CountryPicker({
  value, onChange, language = 'en', label, error, style, placeholder,
}: Props) {
  const Colors = useThemeColors();
  const isRTL = I18nManager.isRTL;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  const selected = useMemo(() => getCountryByCode(value), [value]);
  const displayName = selected ? getCountryDisplayName(selected, language) : '';

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES;
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.en.toLowerCase().includes(q) ||
        c.ar.includes(query.trim()) ||
        c.code.toLowerCase() === q,
    );
  }, [query]);

  const handleSelect = useCallback(
    (country: Country) => {
      onChange(country.code, country.en);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery('');
    setTimeout(() => searchRef.current?.focus(), 80);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // ── Trigger (shared web+mobile) ──────────────────────────────────────────────

  const triggerBorderColor = error ? Colors.error : open ? Colors.neonBlue : Colors.border;
  const triggerBg = error ? Colors.errorDim : Colors.backgroundInput;

  const trigger = (
    <TouchableOpacity
      onPress={handleOpen}
      activeOpacity={0.8}
      style={[
        styles.trigger,
        {
          backgroundColor: triggerBg,
          borderColor: triggerBorderColor,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
        style,
      ]}
    >
      {/* Left icon — matches FormField icon size/color exactly */}
      {selected ? (
        <Text style={styles.flagEmoji}>{countryFlag(selected.code)}</Text>
      ) : (
        // Globe placeholder at the same size as other field icons (14px, textMuted)
        <Text style={[styles.flagEmoji, { color: Colors.textMuted, fontSize: 14, lineHeight: 18 }]}>🌐</Text>
      )}

      {/* Label */}
      <Text
        style={[
          styles.triggerText,
          { color: selected ? Colors.textPrimary : Colors.textMuted, flex: 1,
            textAlign: isRTL ? 'right' : 'left' },
        ]}
        numberOfLines={1}
      >
        {selected ? displayName : (placeholder ?? (language === 'ar' ? 'اختر الدولة' : 'Select country'))}
      </Text>

      {/* Chevron — never pushes via marginLeft auto; uses absolute RTL-aware position */}
      <ChevronDown
        size={14}
        color={Colors.textMuted}
        strokeWidth={2}
        style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
      />
    </TouchableOpacity>
  );

  // ── Inner list (shared) ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: Country }) => {
      const name = getCountryDisplayName(item, language);
      const isSelected = item.code === value;
      return (
        <TouchableOpacity
          style={[
            styles.item,
            { borderBottomColor: Colors.borderLight,
              backgroundColor: isSelected ? Colors.neonBlueGlow : Colors.backgroundCard,
              flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.itemFlag}>{countryFlag(item.code)}</Text>
          <Text
            style={[
              styles.itemName,
              { color: isSelected ? Colors.neonBlue : Colors.textPrimary,
                fontWeight: isSelected ? '700' : '500',
                flex: 1, textAlign: isRTL ? 'right' : 'left' },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isSelected && (
            <View style={[styles.selectedTick, { backgroundColor: Colors.neonBlue }]} />
          )}
        </TouchableOpacity>
      );
    },
    [value, language, isRTL, handleSelect, Colors],
  );

  const listContent = (
    <>
      {/* Search */}
      <View
        style={[
          styles.searchRow,
          { backgroundColor: Colors.backgroundSecondary,
            borderBottomColor: Colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Search size={14} color={Colors.textMuted} strokeWidth={2} />
        <TextInput
          ref={searchRef}
          style={[styles.searchInput, { color: Colors.textPrimary, backgroundColor: Colors.backgroundSecondary }]}
          value={query}
          onChangeText={setQuery}
          placeholder={language === 'ar' ? 'ابحث...' : 'Search...'}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          textAlign={isRTL ? 'right' : 'left'}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={13} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Countries */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.code}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        windowSize={5}
        style={{ maxHeight: 260, backgroundColor: Colors.backgroundCard }}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: Colors.backgroundCard }]}>
            <Text style={[styles.emptyText, { color: Colors.textMuted }]}>
              {language === 'ar' ? 'لا توجد نتائج' : 'No results'}
            </Text>
          </View>
        }
      />
    </>
  );

  // ── Web: Modal overlay so dropdown escapes all parent clipping ───────────────
  // Using a full-screen Modal with a transparent backdrop lets us position the
  // panel relative to the viewport without fighting flex/overflow constraints.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        {label && (
          <Text style={[styles.label, { color: Colors.textMuted }]}>{label}</Text>
        )}
        {trigger}
        {error && (
          <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
        )}

        {open && (
          <Modal
            visible
            transparent
            animationType="none"
            onRequestClose={handleClose}
            // statusBarTranslucent keeps it above status bar on Android web preview
            statusBarTranslucent
          >
            {/* Full-screen backdrop — click outside closes */}
            <Pressable style={styles.webBackdrop} onPress={handleClose} />

            {/* Panel — centred horizontally, positioned near top-of-screen for
                predictable layout. On narrow viewports it fills the width.   */}
            <View style={styles.webPanelPositioner}>
              <View
                style={[
                  styles.webPanel,
                  {
                    backgroundColor: Colors.backgroundCard,
                    borderColor: Colors.border,
                  },
                ]}
              >
                {listContent}
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // ── Mobile: bottom sheet Modal ───────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: Colors.textMuted }]}>{label}</Text>
      )}
      {trigger}
      {error && (
        <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
      )}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.mobileBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <KeyboardAvoidingView behavior="padding" style={styles.mobileSheet}>
            <SafeAreaView
              style={[styles.mobileSheetInner, { backgroundColor: Colors.backgroundCard, borderColor: Colors.border }]}
            >
              {/* Handle */}
              <View style={[styles.sheetHandle, { backgroundColor: Colors.border }]} />
              {/* Header */}
              <View style={[styles.sheetHeader, { borderBottomColor: Colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.sheetTitle, { color: Colors.textPrimary }]}>
                  {language === 'ar' ? 'اختر الدولة' : 'Select Country'}
                </Text>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              {listContent}
              <View style={{ height: 12 }} />
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },

  // Label — identical to checkout fieldLabel
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Trigger row — pixel-for-pixel match with checkout `fieldRow`
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,           // 10
    borderWidth: 1,
    paddingHorizontal: Spacing.md,     // 12
    paddingVertical: Spacing.sm + 2,   // 8  (Spacing.sm=6 + 2)
  },

  flagEmoji: {
    fontSize: 16,
    lineHeight: 20,
    width: 22,
    textAlign: 'center',
  },

  triggerText: {
    fontSize: FontSize.md,   // 14 — matches fieldInput
    padding: 0,
  },

  errorText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },

  // ── Web modal overlay ──
  webBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 1000,
  },
  webPanelPositioner: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    // Let touches through to backdrop except on the panel itself
    pointerEvents: 'box-none' as any,
  },
  webPanel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 24,
  },

  // ── Mobile bottom sheet ──
  mobileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,20,0.75)',
    justifyContent: 'flex-end',
  },
  mobileSheet: {
    width: '100%',
  },
  mobileSheetInner: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%' as any,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  // ── Search bar ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    padding: 0,
    borderWidth: 0,
    // Suppress browser default outline on web focus
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } as any : {}),
  },

  // ── List item ──
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  itemFlag: {
    fontSize: 18,
    lineHeight: 22,
    width: 26,
    textAlign: 'center',
  },
  itemName: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  selectedTick: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },

  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
  },
});
