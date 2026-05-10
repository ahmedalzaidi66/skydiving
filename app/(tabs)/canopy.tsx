import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Wind,
  TriangleAlert as AlertTriangle,
  ShieldCheck,
  CircleCheck as CheckCircle,
  Info,
  RefreshCw,
  Gauge,
  TrendingDown,
} from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import ProductCard from '@/components/ProductCard';
import { fetchProducts, Product } from '@/lib/supabase';
import {
  calculateRecommendation,
  RecommendationResult,
  SuggestedSizeDetail,
  WingLoadingSafety,
} from '@/lib/canopyRecommendation';
import { useLanguage } from '@/context/LanguageContext';
import { Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { useTheme, useThemeColors, ThemeColors } from '@/context/ThemeContext';

type WeightUnit = 'lbs' | 'kg';

// Semantic colors stay static — they are brand/safety indicators, not theme surfaces
const LEVEL_COLORS: Record<string, string> = {
  Beginner: '#00E676',
  Intermediate: '#00BFFF',
  Advanced: '#FFB300',
  Expert: '#FF4444',
};

const LEVEL_DESCRIPTION_KEYS: Record<string, 'beginnerDesc' | 'intermediateDesc' | 'advancedDesc' | 'expertDesc'> = {
  Beginner: 'beginnerDesc',
  Intermediate: 'intermediateDesc',
  Advanced: 'advancedDesc',
  Expert: 'expertDesc',
};

const LEVEL_NAME_KEYS: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
  Beginner: 'beginner',
  Intermediate: 'intermediate',
  Advanced: 'advanced',
  Expert: 'expert',
};

const SAFETY_COLORS: Record<WingLoadingSafety, string> = {
  safe: '#00E676',
  caution: '#FFB300',
  risky: '#FF4444',
  low: '#00BFFF',
};

const SAFETY_LABEL_KEYS: Record<WingLoadingSafety, 'safe' | 'caution' | 'risky' | 'low'> = {
  safe: 'safe',
  caution: 'caution',
  risky: 'risky',
  low: 'low',
};

export default function CanopyScreen() {
  const { t } = useLanguage();
  const C = useThemeColors();
  const { preset } = useTheme();
  const isLight = preset === 'light';

  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [jumps, setJumps] = useState('');
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [weightError, setWeightError] = useState('');
  const [jumpsError, setJumpsError] = useState('');

  const validate = () => {
    let valid = true;
    const w = parseFloat(weight);
    const j = parseInt(jumps);

    if (!weight || isNaN(w) || w <= 0) {
      setWeightError(t.fieldRequired);
      valid = false;
    } else if (unit === 'lbs' && (w < 80 || w > 400)) {
      setWeightError(t.weightRangeLbs);
      valid = false;
    } else if (unit === 'kg' && (w < 36 || w > 180)) {
      setWeightError(t.weightRangeKg);
      valid = false;
    } else {
      setWeightError('');
    }

    if (!jumps || isNaN(j) || j < 0) {
      setJumpsError(t.invalidJumps);
      valid = false;
    } else {
      setJumpsError('');
    }

    return valid;
  };

  const handleCalculate = useCallback(async () => {
    if (!validate()) return;

    setLoading(true);
    const rec = calculateRecommendation(parseFloat(weight), unit, parseInt(jumps));
    setResult(rec);

    const canopyProducts = await fetchProducts({ category: 'canopies', status: 'active', limit: 20 })
      .catch(() => [] as Product[]);
    const ranked = canopyProducts
      .filter(p => p.stock > 0)
      .sort((a, b) => {
        const aScore = (a.is_featured ? 10 : 0) + a.rating + Math.min(a.review_count / 50, 5);
        const bScore = (b.is_featured ? 10 : 0) + b.rating + Math.min(b.review_count / 50, 5);
        return bScore - aScore;
      })
      .slice(0, 4);
    setRelatedProducts(ranked);
    setLoading(false);
  }, [weight, unit, jumps]);

  const handleReset = () => {
    setWeight('');
    setJumps('');
    setResult(null);
    setRelatedProducts([]);
    setWeightError('');
    setJumpsError('');
  };

  // Light-mode premium overrides
  const pageBg = isLight ? '#F4F8FC' : C.background;
  const cardBg = isLight ? '#FFFFFF' : C.backgroundCard;
  const cardBorder = isLight ? 'rgba(0,119,182,0.18)' : C.border;
  const inputBg = isLight ? '#FFFFFF' : C.backgroundSecondary;
  const inputBorder = isLight ? 'rgba(0,119,182,0.28)' : C.border;
  const unitToggleBg = isLight ? '#FFFFFF' : C.backgroundSecondary;
  const secondaryBg = isLight ? '#EEF4FA' : C.backgroundSecondary;
  const barTrackBg = isLight ? '#DDE8F2' : C.background;
  const headingColor = isLight ? '#0D2E4E' : C.textPrimary;
  const labelColor = isLight ? '#1E4A6E' : C.textSecondary;
  const mutedColor = isLight ? '#5A7A96' : C.textMuted;
  const bodyColor = isLight ? '#1A3A55' : C.textSecondary;
  const accentBlue = isLight ? '#0077B6' : C.neonBlue;
  const heroBorderColor = isLight ? 'rgba(0,119,182,0.15)' : C.border;
  const cardShadow = isLight
    ? { shadowColor: '#0077B6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 }
    : {};
  const wlCardShadow = isLight
    ? { shadowColor: '#0077B6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 }
    : Shadow.neonBlueSubtle;

  return (
    <View style={[s.container, { backgroundColor: pageBg }]}>
      <AppHeader />
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <HeroBanner C={C} isLight={isLight} accentBlue={accentBlue} headingColor={headingColor} mutedColor={mutedColor} heroBorderColor={heroBorderColor} />

        <View style={[s.disclaimerBanner, { backgroundColor: isLight ? 'rgba(0,119,182,0.07)' : C.neonBlueGlow, borderColor: isLight ? 'rgba(0,119,182,0.22)' : C.neonBlueBorder }]}>
          <Info size={14} color={accentBlue} strokeWidth={2} />
          <Text style={[s.disclaimerText, { color: accentBlue }]}>
            {t.canopyDisclaimer}
          </Text>
        </View>

        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }, cardShadow]}>
          <Text style={[s.cardTitle, { color: headingColor }]}>{t.yourProfile}</Text>
          <Text style={[s.cardSubtitle, { color: mutedColor }]}>{t.enterWeightAndJumps}</Text>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: labelColor }]}>{t.yourWeight}</Text>
            <View style={s.weightRow}>
              <TextInput
                style={[
                  s.input,
                  s.weightInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: headingColor },
                  weightError ? { borderColor: '#D63031' } : undefined,
                ]}
                value={weight}
                onChangeText={(v) => { setWeight(v); setWeightError(''); }}
                placeholder={unit === 'lbs' ? t.canopyWeightPlaceholderLbs : t.canopyWeightPlaceholderKg}
                placeholderTextColor={mutedColor}
                keyboardType="decimal-pad"
              />
              <View style={[s.unitToggle, { backgroundColor: unitToggleBg, borderColor: inputBorder }]}>
                {(['lbs', 'kg'] as WeightUnit[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      s.unitBtn,
                      unit === u && { backgroundColor: accentBlue },
                    ]}
                    onPress={() => { setUnit(u); setWeight(''); setWeightError(''); }}
                  >
                    <Text style={[
                      s.unitBtnText,
                      { color: mutedColor },
                      unit === u && { color: '#FFFFFF' },
                    ]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {weightError ? <Text style={[s.errorText, { color: '#D63031' }]}>{weightError}</Text> : null}
            <Text style={[s.hintText, { color: mutedColor }]}>{t.weightHint}</Text>
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: labelColor }]}>{t.totalJumps}</Text>
            <TextInput
              style={[
                s.input,
                { backgroundColor: inputBg, borderColor: inputBorder, color: headingColor },
                jumpsError ? { borderColor: '#D63031' } : undefined,
              ]}
              value={jumps}
              onChangeText={(v) => { setJumps(v); setJumpsError(''); }}
              placeholder={t.totalJumpsPlaceholder}
              placeholderTextColor={mutedColor}
              keyboardType="number-pad"
            />
            {jumpsError ? <Text style={[s.errorText, { color: '#D63031' }]}>{jumpsError}</Text> : null}
          </View>

          <ExperiencePreview jumps={parseInt(jumps) || 0} hasJumps={jumps.length > 0} mutedColor={mutedColor} />

          {isLight ? (
            <TouchableOpacity
              style={[s.calcBtn, s.calcBtnLight, loading && s.calcBtnDisabled]}
              onPress={handleCalculate}
              activeOpacity={0.85}
              disabled={loading}
            >
              <LinearGradient
                colors={['#0096C7', '#0077B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.calcBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Wind size={18} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={[s.calcBtnText, { color: '#FFFFFF' }]}>{t.getRecommendation}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.calcBtn, { backgroundColor: C.neonBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }, loading && s.calcBtnDisabled]}
              onPress={handleCalculate}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.background} size="small" />
              ) : (
                <>
                  <Wind size={18} color={C.background} strokeWidth={2.5} />
                  <Text style={[s.calcBtnText, { color: C.background }]}>{t.getRecommendation}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {result && (
          <>
            <ResultSection
              result={result}
              onReset={handleReset}
              C={C}
              isLight={isLight}
              headingColor={headingColor}
              labelColor={labelColor}
              mutedColor={mutedColor}
              bodyColor={bodyColor}
              accentBlue={accentBlue}
              cardBg={cardBg}
              cardBorder={cardBorder}
              secondaryBg={secondaryBg}
              barTrackBg={barTrackBg}
              cardShadow={cardShadow}
              wlCardShadow={wlCardShadow}
            />

            {relatedProducts.length > 0 && (
              <View style={s.productsSection}>
                <Text style={[s.sectionTitle, { color: headingColor }]}>{t.matchingProducts}</Text>
                <Text style={[s.sectionSubtitle, { color: mutedColor }]}>{t.matchingProductsSubtitle}</Text>
                <View style={s.productsGrid}>
                  {relatedProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}

function HeroBanner({
  C, isLight, accentBlue, headingColor, mutedColor, heroBorderColor,
}: {
  C: ThemeColors; isLight: boolean; accentBlue: string;
  headingColor: string; mutedColor: string; heroBorderColor: string;
}) {
  const { t } = useLanguage();
  return (
    <View style={[s.hero, { borderBottomColor: heroBorderColor }]}>
      <LinearGradient
        colors={isLight
          ? ['rgba(0,119,182,0.07)', 'rgba(0,150,199,0.03)', 'transparent']
          : ['rgba(0,191,255,0.12)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.heroIcon, {
        backgroundColor: isLight ? 'rgba(0,119,182,0.1)' : C.neonBlueGlow,
        borderColor: isLight ? 'rgba(0,119,182,0.3)' : C.neonBlueBorder,
      }]}>
        <Wind size={28} color={accentBlue} strokeWidth={1.5} />
      </View>
      <Text style={[s.heroTitle, { color: headingColor }]}>{t.canopyAdvisor}</Text>
      <Text style={[s.heroSubtitle, { color: mutedColor }]}>{t.canopySubtitle}</Text>
    </View>
  );
}

function ExperiencePreview({
  jumps, hasJumps, mutedColor,
}: {
  jumps: number; hasJumps: boolean; mutedColor: string;
}) {
  const { t } = useLanguage();
  if (!hasJumps || isNaN(jumps)) return null;
  const levelKey = jumps <= 100 ? 'Beginner' : jumps <= 300 ? 'Intermediate' : jumps <= 500 ? 'Advanced' : 'Expert';
  const color = LEVEL_COLORS[levelKey];
  const nameKey = LEVEL_NAME_KEYS[levelKey];
  const descKey = LEVEL_DESCRIPTION_KEYS[levelKey];
  return (
    <View style={[s.levelPreview, { borderColor: color + '44', backgroundColor: color + '12' }]}>
      <View style={[s.levelDot, { backgroundColor: color }]} />
      <Text style={[s.levelName, { color }]}>{t[nameKey]}</Text>
      <Text style={[s.levelDesc, { color: mutedColor }]}>{t[descKey]}</Text>
    </View>
  );
}

function SafetyBadge({ safety }: { safety: WingLoadingSafety }) {
  const { t } = useLanguage();
  const color = SAFETY_COLORS[safety];
  const labelKey = SAFETY_LABEL_KEYS[safety];
  return (
    <View style={[s.safetyBadge, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
      <View style={[s.safetyDot, { backgroundColor: color }]} />
      <Text style={[s.safetyBadgeText, { color }]}>{t[labelKey]}</Text>
    </View>
  );
}

function WingLoadingCard({
  result, C, isLight, headingColor, labelColor, mutedColor, cardBg, cardBorder,
  secondaryBg, barTrackBg, wlCardShadow,
}: {
  result: RecommendationResult;
  C: ThemeColors; isLight: boolean;
  headingColor: string; labelColor: string; mutedColor: string;
  cardBg: string; cardBorder: string; secondaryBg: string;
  barTrackBg: string; wlCardShadow: object;
}) {
  const { t } = useLanguage();
  const levelColor = LEVEL_COLORS[result.experienceLevel];
  const levelNameKey = LEVEL_NAME_KEYS[result.experienceLevel] ?? 'beginner';
  const hasHighWl = result.suggestedSizeDetails.some((d) => d.safety === 'risky' || d.safety === 'caution');
  const hasLowWl = result.suggestedSizeDetails.some((d) => d.safety === 'low');
  const accentBlue = isLight ? '#0077B6' : C.neonBlue;

  return (
    <View style={[s.wlCard, { backgroundColor: cardBg, borderColor: isLight ? 'rgba(0,119,182,0.22)' : C.neonBlueBorder }, wlCardShadow]}>
      <LinearGradient
        colors={isLight
          ? ['rgba(0,119,182,0.06)', 'rgba(0,150,199,0.02)', 'transparent']
          : ['rgba(0,191,255,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={s.wlCardHeader}>
        <View style={s.wlCardTitleRow}>
          <Gauge size={18} color={accentBlue} strokeWidth={2} />
          <Text style={[s.wlCardTitle, { color: headingColor }]}>{t.wingLoading}</Text>
        </View>
        <Text style={[s.wlFormula, { color: mutedColor }]}>{t.wingLoadingFormula}</Text>
      </View>

      <View style={[s.wlRangeBlock, { backgroundColor: secondaryBg }]}>
        <Text style={[s.wlRangeLabel, { color: mutedColor }]}>{t.safeRangeFor} {t[levelNameKey]}</Text>
        <View style={s.wlRangeRow}>
          <Text style={[s.wlRangeValue, { color: levelColor }]}>
            {result.wingLoadingMin} – {result.wingLoadingMax}
          </Text>
          <Text style={[s.wlRangeUnit, { color: mutedColor }]}>{t.lbSqFt}</Text>
        </View>
        <View style={s.wlRangeSubRow}>
          <Text style={[s.wlSubText, { color: mutedColor }]}>
            At min size ({result.canopySizeMin} {t.sqft}):{' '}
            <Text style={[s.wlSubValue, { color: isLight ? '#1E4A6E' : C.textSecondary }]}>{result.wingLoadingAtMinSize} {t.lbSqFt}</Text>
          </Text>
          <Text style={[s.wlSubText, { color: mutedColor }]}>
            At max size ({result.canopySizeMax} {t.sqft}):{' '}
            <Text style={[s.wlSubValue, { color: isLight ? '#1E4A6E' : C.textSecondary }]}>{result.wingLoadingAtMaxSize} {t.lbSqFt}</Text>
          </Text>
        </View>
      </View>

      <View style={[s.wlDivider, { backgroundColor: isLight ? 'rgba(0,119,182,0.12)' : C.border }]} />

      <View style={s.wlSuggestedSection}>
        <Text style={[s.wlSuggestedTitle, { color: labelColor }]}>{t.wingLoadingBySuggestedSize}</Text>
        <View style={s.wlSuggestedList}>
          {result.suggestedSizeDetails.map((detail, i) => (
            <WingLoadingRow
              key={detail.size}
              detail={detail}
              isFirst={i === 0}
              weightLbs={result.weightLbs}
              C={C}
              isLight={isLight}
              mutedColor={mutedColor}
              headingColor={headingColor}
              secondaryBg={secondaryBg}
              barTrackBg={barTrackBg}
            />
          ))}
        </View>
      </View>

      {hasHighWl && (
        <View style={[s.wlWarningHigh, { backgroundColor: '#FFB300' + '12', borderColor: '#FFB300' + '44' }]}>
          <AlertTriangle size={14} color="#FFB300" strokeWidth={2} />
          <Text style={[s.wlWarningText, { color: '#FFB300' }]}>{t.highWingLoadingWarning}</Text>
        </View>
      )}

      {hasLowWl && !hasHighWl && (
        <View style={[s.wlWarningLow, { backgroundColor: isLight ? 'rgba(0,119,182,0.07)' : C.neonBlueGlow, borderColor: isLight ? 'rgba(0,119,182,0.22)' : C.neonBlueBorder }]}>
          <TrendingDown size={14} color={accentBlue} strokeWidth={2} />
          <Text style={[s.wlWarningLowText, { color: accentBlue }]}>{t.lowWingLoadingNote}</Text>
        </View>
      )}

      <View style={s.wlLegend}>
        {(['safe', 'caution', 'risky', 'low'] as WingLoadingSafety[]).map((safety) => (
          <View key={safety} style={s.wlLegendItem}>
            <View style={[s.wlLegendDot, { backgroundColor: SAFETY_COLORS[safety] }]} />
            <Text style={[s.wlLegendText, { color: mutedColor }]}>{t[SAFETY_LABEL_KEYS[safety]]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WingLoadingRow({
  detail, isFirst, weightLbs, C, isLight, mutedColor, headingColor, secondaryBg, barTrackBg,
}: {
  detail: SuggestedSizeDetail;
  isFirst: boolean;
  weightLbs: number;
  C: ThemeColors; isLight: boolean;
  mutedColor: string; headingColor: string;
  secondaryBg: string; barTrackBg: string;
}) {
  const { t } = useLanguage();
  const color = SAFETY_COLORS[detail.safety];
  const barWidth = Math.min(100, (detail.wingLoading / 2.0) * 100);

  return (
    <View style={[
      s.wlRow,
      { backgroundColor: secondaryBg, borderColor: isLight ? 'rgba(0,119,182,0.15)' : C.border },
      isFirst && { borderColor: color + '55', backgroundColor: color + '0A' },
    ]}>
      <View style={s.wlRowTop}>
        <View style={s.wlRowLeft}>
          {isFirst && <CheckCircle size={13} color={color} strokeWidth={2.5} />}
          <Text style={[s.wlRowSize, { color: headingColor }, isFirst && { color }]}>{detail.size}</Text>
          <Text style={[s.wlRowSizeUnit, { color: mutedColor }]}>{t.sqft}</Text>
        </View>
        <View style={s.wlRowRight}>
          <Text style={[s.wlRowValue, { color }]}>{detail.wingLoading}</Text>
          <Text style={[s.wlRowValueUnit, { color: mutedColor }]}>{t.lbSqFt}</Text>
          <SafetyBadge safety={detail.safety} />
        </View>
      </View>
      <View style={[s.wlBarTrack, { backgroundColor: barTrackBg }]}>
        <View style={[s.wlBarFill, { width: `${barWidth}%` as any, backgroundColor: color }]} />
        <View style={s.wlBarMarker} />
      </View>
      <Text style={[s.wlRowCalc, { color: mutedColor }]}>{weightLbs} lbs ÷ {detail.size} {t.sqft} = {detail.wingLoading}</Text>
    </View>
  );
}

function ResultSection({
  result, onReset, C, isLight, headingColor, labelColor, mutedColor, bodyColor,
  accentBlue, cardBg, cardBorder, secondaryBg, barTrackBg, cardShadow, wlCardShadow,
}: {
  result: RecommendationResult;
  onReset: () => void;
  C: ThemeColors; isLight: boolean;
  headingColor: string; labelColor: string; mutedColor: string; bodyColor: string;
  accentBlue: string; cardBg: string; cardBorder: string;
  secondaryBg: string; barTrackBg: string;
  cardShadow: object; wlCardShadow: object;
}) {
  const { t } = useLanguage();
  const levelColor = LEVEL_COLORS[result.experienceLevel];
  const levelNameKey = LEVEL_NAME_KEYS[result.experienceLevel] ?? 'beginner';

  return (
    <View style={s.resultContainer}>
      <View style={s.resultHeader}>
        <Text style={[s.resultHeading, { color: headingColor }]}>{t.yourRecommendation}</Text>
        <TouchableOpacity style={s.resetBtn} onPress={onReset} activeOpacity={0.7}>
          <RefreshCw size={14} color={mutedColor} strokeWidth={2} />
          <Text style={[s.resetBtnText, { color: mutedColor }]}>{t.reset}</Text>
        </TouchableOpacity>
      </View>

      {result.isUnsafe && (
        <View style={[s.unsafeWarning, { backgroundColor: '#FF4444' + '15', borderColor: '#FF4444' + '55' }]}>
          <AlertTriangle size={18} color="#FF4444" strokeWidth={2} />
          <Text style={[s.unsafeWarningText, { color: '#FF4444' }]}>{t.riskyConfigWarning}</Text>
        </View>
      )}

      {result.isBeginner && (
        <View style={[s.beginnerWarning, { backgroundColor: '#FFB300' + '15', borderColor: '#FFB300' + '55' }]}>
          <AlertTriangle size={18} color="#FFB300" strokeWidth={2} />
          <Text style={[s.beginnerWarningText, { color: '#FFB300' }]}>{t.beginnerHighPerfWarning}</Text>
        </View>
      )}

      {/* Result card with light-mode glass gradient */}
      <View style={[s.resultCard, { backgroundColor: cardBg, borderColor: cardBorder }, cardShadow]}>
        {isLight ? (
          <LinearGradient
            colors={['rgba(0,119,182,0.06)', 'rgba(0,150,199,0.03)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ) : (
          <LinearGradient
            colors={[levelColor + '18', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        <View style={s.resultTopRow}>
          <View style={[s.levelBadge, { backgroundColor: levelColor + '22', borderColor: levelColor + '44' }]}>
            <View style={[s.levelDot, { backgroundColor: levelColor }]} />
            <Text style={[s.levelBadgeText, { color: levelColor }]}>{t[levelNameKey]}</Text>
          </View>
          <Text style={[s.weightDisplay, { color: mutedColor }]}>{result.weightLbs} lbs</Text>
        </View>

        <View style={s.sizeRangeBlock}>
          <Text style={[s.sizeRangeLabel, { color: labelColor }]}>{t.recommendedSizeRange}</Text>
          <View style={s.sizeRangeRow}>
            <Text style={[s.sizeRangeValue, { color: isLight ? '#0077B6' : levelColor }]}>
              {result.canopySizeMin}–{result.canopySizeMax}
            </Text>
            <Text style={[s.sizeUnit, { color: mutedColor }]}>{t.sqft}</Text>
          </View>
        </View>

        {result.suggestedSizes.length > 0 && (
          <View style={s.suggestedBlock}>
            <Text style={[s.suggestedLabel, { color: labelColor }]}>{t.suggestedSizes}</Text>
            <View style={s.suggestedRow}>
              {result.suggestedSizes.map((size, i) => (
                <View key={size} style={[
                  s.sizePill,
                  { backgroundColor: secondaryBg, borderColor: isLight ? 'rgba(0,119,182,0.2)' : C.border },
                  i === 0 && { borderColor: levelColor, backgroundColor: levelColor + '18' },
                ]}>
                  {i === 0 && <CheckCircle size={12} color={levelColor} strokeWidth={2.5} />}
                  <Text style={[s.sizePillText, { color: headingColor }, i === 0 && { color: levelColor }]}>{size}</Text>
                  <Text style={[s.sizePillUnit, { color: mutedColor }]}>{t.sqft}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <WingLoadingCard
        result={result}
        C={C}
        isLight={isLight}
        headingColor={headingColor}
        labelColor={labelColor}
        mutedColor={mutedColor}
        cardBg={cardBg}
        cardBorder={cardBorder}
        secondaryBg={secondaryBg}
        barTrackBg={barTrackBg}
        wlCardShadow={wlCardShadow}
      />

      <View style={[s.explanationCard, { backgroundColor: cardBg, borderColor: cardBorder }, cardShadow]}>
        <View style={s.explanationHeader}>
          <ShieldCheck size={16} color={accentBlue} strokeWidth={2} />
          <Text style={[s.explanationTitle, { color: headingColor }]}>{t.howCalculated}</Text>
        </View>
        <Text style={[s.explanationText, { color: bodyColor }]}>
          {t.canopyExplanationIntro} ({t[levelNameKey]}) {t.canopyExplanationRange}{' '}
          <Text style={[s.explanationHighlight, { color: accentBlue }]}>{result.wingLoadingMin}–{result.wingLoadingMax} {t.lbSqFt}</Text>.
          {'\n\n'}
          {t.canopyExplanationFormula}{'\n'}
          <Text style={[s.explanationHighlight, { color: accentBlue }]}>{result.weightLbs} lbs ÷ {result.wingLoadingMax} = {result.canopySizeMin} {t.sqft} ({t.canopyExplanationMin})</Text>
          {'\n'}
          <Text style={[s.explanationHighlight, { color: accentBlue }]}>{result.weightLbs} lbs ÷ {result.wingLoadingMin} = {result.canopySizeMax} {t.sqft} ({t.canopyExplanationMax})</Text>
        </Text>
      </View>

      <View style={[s.mandatoryWarning, { backgroundColor: '#FFB300' + '12', borderColor: '#FFB300' + '44' }]}>
        <AlertTriangle size={16} color="#FFB300" strokeWidth={2} />
        <Text style={[s.mandatoryWarningText, { color: '#FFB300' }]}>{t.canopySafetyFinal}</Text>
      </View>
    </View>
  );
}

// Layout-only styles — no color values
const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.hero, fontWeight: '900',
    letterSpacing: -1, lineHeight: 40,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: { fontSize: FontSize.md, lineHeight: 22 },
  disclaimerBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1, borderRadius: Radius.md,
  },
  disclaimerText: {
    flex: 1, fontSize: FontSize.xs, lineHeight: 18, fontWeight: '500',
  },
  card: {
    margin: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 4 },
  cardSubtitle: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8,
  },
  weightRow: { flexDirection: 'row', gap: Spacing.sm },
  weightInput: { flex: 1 },
  input: {
    borderWidth: 1.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.lg, fontWeight: '600',
  },
  unitToggle: {
    flexDirection: 'row',
    borderWidth: 1.5, borderRadius: Radius.md,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  unitBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  errorText: { fontSize: FontSize.xs, marginTop: 4 },
  hintText: { fontSize: FontSize.xs, marginTop: 6, lineHeight: 16 },
  levelPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1,
    marginBottom: Spacing.md,
  },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  levelName: { fontSize: FontSize.sm, fontWeight: '800' },
  levelDesc: { fontSize: FontSize.xs, fontWeight: '500' },
  calcBtn: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.neonBlue,
  },
  calcBtnLight: {
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  calcBtnDisabled: { opacity: 0.7 },
  calcBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  calcBtnText: { fontSize: FontSize.md, fontWeight: '800', letterSpacing: 0.3 },
  resultContainer: { marginHorizontal: Spacing.md, gap: Spacing.md },
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  resultHeading: { fontSize: FontSize.xl, fontWeight: '800' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6,
  },
  resetBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  unsafeWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: Spacing.md, borderWidth: 1.5, borderRadius: Radius.lg,
  },
  unsafeWarningText: {
    flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20,
  },
  beginnerWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: Spacing.md, borderWidth: 1.5, borderRadius: Radius.lg,
  },
  beginnerWarningText: {
    flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20,
  },
  resultCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, overflow: 'hidden', gap: Spacing.md,
  },
  resultTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1,
  },
  levelBadgeText: { fontSize: FontSize.sm, fontWeight: '800' },
  weightDisplay: { fontSize: FontSize.sm, fontWeight: '500' },
  sizeRangeBlock: { gap: 4 },
  sizeRangeLabel: {
    fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sizeRangeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  sizeRangeValue: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  sizeUnit: { fontSize: FontSize.md, fontWeight: '600' },
  suggestedBlock: { gap: 10 },
  suggestedLabel: {
    fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  suggestedRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  sizePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.md, borderWidth: 1.5,
  },
  sizePillText: { fontSize: FontSize.lg, fontWeight: '800' },
  sizePillUnit: { fontSize: FontSize.xs, fontWeight: '600' },
  wlCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, overflow: 'hidden', gap: Spacing.md,
  },
  wlCardHeader: { gap: 4 },
  wlCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wlCardTitle: { fontSize: FontSize.xl, fontWeight: '800' },
  wlFormula: { fontSize: FontSize.xs, fontStyle: 'italic', marginLeft: 26 },
  wlRangeBlock: { borderRadius: Radius.lg, padding: Spacing.md, gap: 6 },
  wlRangeLabel: {
    fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  wlRangeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  wlRangeValue: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  wlRangeUnit: { fontSize: FontSize.sm, fontWeight: '600' },
  wlRangeSubRow: { gap: 2, marginTop: 4 },
  wlSubText: { fontSize: FontSize.xs, lineHeight: 18 },
  wlSubValue: { fontWeight: '700' },
  wlDivider: { height: 1 },
  wlSuggestedSection: { gap: Spacing.sm },
  wlSuggestedTitle: {
    fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  wlSuggestedList: { gap: Spacing.sm },
  wlRow: {
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1.5, gap: 8,
  },
  wlRowTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  wlRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wlRowSize: { fontSize: FontSize.xl, fontWeight: '900' },
  wlRowSizeUnit: { fontSize: FontSize.xs, fontWeight: '600' },
  wlRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wlRowValue: { fontSize: FontSize.xl, fontWeight: '900' },
  wlRowValueUnit: { fontSize: FontSize.xs, fontWeight: '600' },
  wlBarTrack: {
    height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative',
  },
  wlBarFill: { height: '100%', borderRadius: 3, opacity: 0.8 },
  wlBarMarker: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 1, backgroundColor: 'transparent',
  },
  wlRowCalc: { fontSize: FontSize.xs, fontWeight: '500' },
  safetyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1,
  },
  safetyDot: { width: 5, height: 5, borderRadius: 3 },
  safetyBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  wlWarningHigh: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: Spacing.md, borderWidth: 1, borderRadius: Radius.md,
  },
  wlWarningText: { flex: 1, fontSize: FontSize.xs, fontWeight: '600', lineHeight: 18 },
  wlWarningLow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: Spacing.md, borderWidth: 1, borderRadius: Radius.md,
  },
  wlWarningLowText: { flex: 1, fontSize: FontSize.xs, fontWeight: '600', lineHeight: 18 },
  wlLegend: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  wlLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wlLegendDot: { width: 7, height: 7, borderRadius: 4 },
  wlLegendText: { fontSize: FontSize.xs, fontWeight: '600' },
  explanationCard: {
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, gap: Spacing.sm,
  },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  explanationTitle: { fontSize: FontSize.md, fontWeight: '700' },
  explanationText: { fontSize: FontSize.sm, lineHeight: 22 },
  explanationHighlight: { fontWeight: '700' },
  mandatoryWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: Spacing.lg, borderWidth: 1.5, borderRadius: Radius.lg,
  },
  mandatoryWarningText: {
    flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20,
  },
  productsSection: {
    marginTop: Spacing.xl, marginHorizontal: Spacing.md, gap: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '800' },
  sectionSubtitle: { fontSize: FontSize.sm, marginTop: -8 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  bottomPad: { height: 24 },
});
