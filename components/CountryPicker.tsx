import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import { ChevronDown, Search, X, MapPin } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

export type Country = {
  code: string;   // ISO 3166-1 alpha-2
  en: string;     // English name
  ar: string;     // Arabic name
};

// Full country list with ISO codes and Arabic names
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

type Props = {
  value: string;        // ISO code (e.g. "US"), or empty string
  onChange: (code: string, displayName: string) => void;
  language?: string;    // current app language
  label?: string;
  error?: string;
  style?: object;
  placeholder?: string;
};

export default function CountryPicker({
  value,
  onChange,
  language = 'en',
  label,
  error,
  style,
  placeholder,
}: Props) {
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
        c.code.toLowerCase() === q
    );
  }, [query]);

  const handleSelect = useCallback(
    (country: Country) => {
      onChange(country.code, country.en);
      setOpen(false);
      setQuery('');
    },
    [onChange]
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery('');
    // Focus search on next tick
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Country }) => {
      const name = getCountryDisplayName(item, language);
      const isSelected = item.code === value;
      return (
        <TouchableOpacity
          style={[styles.item, isSelected && styles.itemSelected]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.itemFlag}>{countryFlag(item.code)}</Text>
          <Text style={[styles.itemName, isSelected && styles.itemNameSelected]} numberOfLines={1}>
            {name}
          </Text>
          {language === 'ar' && item.en !== item.ar && (
            <Text style={styles.itemSub} numberOfLines={1}>{item.en}</Text>
          )}
          {isSelected && (
            <View style={styles.selectedDot} />
          )}
        </TouchableOpacity>
      );
    },
    [value, language, handleSelect]
  );

  const triggerContent = (
    <TouchableOpacity
      style={[styles.trigger, !!error && styles.triggerError, style]}
      onPress={handleOpen}
      activeOpacity={0.8}
    >
      {selected ? (
        <>
          <Text style={styles.triggerFlag}>{countryFlag(selected.code)}</Text>
          <Text style={styles.triggerValue} numberOfLines={1}>{displayName}</Text>
        </>
      ) : (
        <>
          <MapPin size={14} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.triggerPlaceholder} numberOfLines={1}>
            {placeholder ?? (language === 'ar' ? 'اختر الدولة' : 'Select country')}
          </Text>
        </>
      )}
      <ChevronDown size={16} color={Colors.textMuted} strokeWidth={2} style={{ marginLeft: 'auto' } as any} />
    </TouchableOpacity>
  );

  const listContent = (
    <>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Search size={14} color={Colors.textMuted} strokeWidth={2} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={language === 'ar' ? 'ابحث بالعربية أو الإنجليزية...' : 'Search countries...'}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Country list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        windowSize={5}
        getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد نتائج' : 'No countries found'}
            </Text>
          </View>
        }
      />
    </>
  );

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      {triggerContent}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Platform-specific dropdown */}
      {Platform.OS === 'web' ? (
        open ? (
          <>
            {/* Click-away backdrop */}
            <Pressable style={styles.webBackdrop} onPress={handleClose} />
            <View style={styles.webDropdown}>
              {listContent}
            </View>
          </>
        ) : null
      ) : (
        <Modal
          visible={open}
          animationType="slide"
          transparent
          onRequestClose={handleClose}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill as any} onPress={handleClose} />
            <KeyboardAvoidingView
              behavior="padding"
              style={styles.modalSheet}
            >
              <SafeAreaView style={{ flex: 1 }}>
                {/* Handle */}
                <View style={styles.sheetHandle} />
                {/* Header */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {language === 'ar' ? 'اختر الدولة' : 'Select Country'}
                  </Text>
                  <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={20} color={Colors.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                {listContent}
              </SafeAreaView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Emoji flag from ISO code
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const offset = 127397;
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + offset,
    code.toUpperCase().charCodeAt(1) + offset
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
    position: 'relative',
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 44,
  },
  triggerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorDim,
  },
  triggerFlag: {
    fontSize: 18,
    lineHeight: 22,
  },
  triggerValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  triggerPlaceholder: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },

  // ── Web dropdown ──
  webBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  webDropdown: {
    position: 'absolute' as any,
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
    maxHeight: 320,
    overflow: 'hidden',
  },

  // ── Mobile modal sheet ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,20,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 400,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
  },

  // ── List items ──
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    minHeight: 48,
  },
  itemSelected: {
    backgroundColor: Colors.neonBlueGlow,
  },
  itemFlag: {
    fontSize: 20,
    lineHeight: 24,
    width: 28,
    textAlign: 'center',
  },
  itemName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  itemNameSelected: {
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  itemSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    maxWidth: 100,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.neonBlue,
  },

  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
