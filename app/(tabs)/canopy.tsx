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
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

type WeightUnit = 'lbs' | 'kg';

const LEVEL_COLORS: Record<string, string> = {
  Beginner: Colors.success,
  Intermediate: Colors.neonBlue,
  Advanced: Colors.warning,
  Expert: Colors.error,
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
  safe: Colors.success,
  caution: Colors.warning,
  risky: Colors.error,
  low: Colors.neonBlue,
};

const SAFETY_LABEL_KEYS: Record<WingLoadingSafety, 'safe' | 'caution' | 'risky' | 'low'> = {
  safe: 'safe',
  caution: 'caution',
  risky: 'risky',
  low: 'low',
};

export default function CanopyScreen() {
  const { t } = useLanguage();
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

    // Fetch in-stock canopy/safety products, ranked by featured + rating
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

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroBanner />

        <View style={styles.disclaimerBanner}>
          <Info size={14} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.disclaimerText}>
            {t.canopyDisclaimer}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.yourProfile}</Text>
          <Text style={styles.cardSubtitle}>{t.enterWeightAndJumps}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t.yourWeight}</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={[styles.input, styles.weightInput, weightError ? styles.inputError : undefined]}
                value={weight}
                onChangeText={(v) => { setWeight(v); setWeightError(''); }}
                placeholder={unit === 'lbs' ? t.canopyWeightPlaceholderLbs : t.canopyWeightPlaceholderKg}
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
              <View style={styles.unitToggle}>
                {(['lbs', 'kg'] as WeightUnit[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                    onPress={() => { setUnit(u); setWeight(''); setWeightError(''); }}
                  >
                    <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {weightError ? <Text style={styles.errorText}>{weightError}</Text> : null}
            <Text style={styles.hintText}>{t.weightHint}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t.totalJumps}</Text>
            <TextInput
              style={[styles.input, jumpsError ? styles.inputError : undefined]}
              value={jumps}
              onChangeText={(v) => { setJumps(v); setJumpsError(''); }}
              placeholder={t.totalJumpsPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
            {jumpsError ? <Text style={styles.errorText}>{jumpsError}</Text> : null}
          </View>

          <ExperiencePreview jumps={parseInt(jumps) || 0} hasJumps={jumps.length > 0} />

          <TouchableOpacity
            style={[styles.calcBtn, loading && styles.calcBtnDisabled]}
            onPress={handleCalculate}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <>
                <Wind size={18} color={Colors.background} strokeWidth={2.5} />
                <Text style={styles.calcBtnText}>{t.getRecommendation}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <>
            <ResultSection result={result} onReset={handleReset} />

            {relatedProducts.length > 0 && (
              <View style={styles.productsSection}>
                <Text style={styles.sectionTitle}>{t.matchingProducts}</Text>
                <Text style={styles.sectionSubtitle}>{t.matchingProductsSubtitle}</Text>
                <View style={styles.productsGrid}>
                  {relatedProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

function HeroBanner() {
  const { t } = useLanguage();
  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={['rgba(0,191,255,0.12)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroIcon}>
        <Wind size={28} color={Colors.neonBlue} strokeWidth={1.5} />
      </View>
      <Text style={styles.heroTitle}>{t.canopyAdvisor}</Text>
      <Text style={styles.heroSubtitle}>{t.canopySubtitle}</Text>
    </View>
  );
}

function ExperiencePreview({ jumps, hasJumps }: { jumps: number; hasJumps: boolean }) {
  const { t } = useLanguage();
  if (!hasJumps || isNaN(jumps)) return null;
  const levelKey = jumps <= 100 ? 'Beginner' : jumps <= 300 ? 'Intermediate' : jumps <= 500 ? 'Advanced' : 'Expert';
  const color = LEVEL_COLORS[levelKey];
  const nameKey = LEVEL_NAME_KEYS[levelKey];
  const descKey = LEVEL_DESCRIPTION_KEYS[levelKey];
  return (
    <View style={[styles.levelPreview, { borderColor: color + '44', backgroundColor: color + '12' }]}>
      <View style={[styles.levelDot, { backgroundColor: color }]} />
      <Text style={[styles.levelName, { color }]}>{t[nameKey]}</Text>
      <Text style={styles.levelDesc}>{t[descKey]}</Text>
    </View>
  );
}

function SafetyBadge({ safety }: { safety: WingLoadingSafety }) {
  const { t } = useLanguage();
  const color = SAFETY_COLORS[safety];
  const labelKey = SAFETY_LABEL_KEYS[safety];
  return (
    <View style={[styles.safetyBadge, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
      <View style={[styles.safetyDot, { backgroundColor: color }]} />
      <Text style={[styles.safetyBadgeText, { color }]}>{t[labelKey]}</Text>
    </View>
  );
}

function WingLoadingCard({ result }: { result: RecommendationResult }) {
  const { t } = useLanguage();
  const levelColor = LEVEL_COLORS[result.experienceLevel];
  const levelNameKey = LEVEL_NAME_KEYS[result.experienceLevel] ?? 'beginner';
  const hasHighWl = result.suggestedSizeDetails.some((d) => d.safety === 'risky' || d.safety === 'caution');
  const hasLowWl = result.suggestedSizeDetails.some((d) => d.safety === 'low');

  return (
    <View style={styles.wlCard}>
      <LinearGradient
        colors={['rgba(0,191,255,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.wlCardHeader}>
        <View style={styles.wlCardTitleRow}>
          <Gauge size={18} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.wlCardTitle}>{t.wingLoading}</Text>
        </View>
        <Text style={styles.wlFormula}>{t.wingLoadingFormula}</Text>
      </View>

      <View style={styles.wlRangeBlock}>
        <Text style={styles.wlRangeLabel}>{t.safeRangeFor} {t[levelNameKey]}</Text>
        <View style={styles.wlRangeRow}>
          <Text style={[styles.wlRangeValue, { color: levelColor }]}>
            {result.wingLoadingMin} – {result.wingLoadingMax}
          </Text>
          <Text style={styles.wlRangeUnit}>{t.lbSqFt}</Text>
        </View>
        <View style={styles.wlRangeSubRow}>
          <Text style={styles.wlSubText}>
            At min size ({result.canopySizeMin} {t.sqft}):{' '}
            <Text style={styles.wlSubValue}>{result.wingLoadingAtMinSize} {t.lbSqFt}</Text>
          </Text>
          <Text style={styles.wlSubText}>
            At max size ({result.canopySizeMax} {t.sqft}):{' '}
            <Text style={styles.wlSubValue}>{result.wingLoadingAtMaxSize} {t.lbSqFt}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.wlDivider} />

      <View style={styles.wlSuggestedSection}>
        <Text style={styles.wlSuggestedTitle}>{t.wingLoadingBySuggestedSize}</Text>
        <View style={styles.wlSuggestedList}>
          {result.suggestedSizeDetails.map((detail, i) => (
            <WingLoadingRow key={detail.size} detail={detail} isFirst={i === 0} weightLbs={result.weightLbs} />
          ))}
        </View>
      </View>

      {hasHighWl && (
        <View style={styles.wlWarningHigh}>
          <AlertTriangle size={14} color={Colors.warning} strokeWidth={2} />
          <Text style={styles.wlWarningText}>{t.highWingLoadingWarning}</Text>
        </View>
      )}

      {hasLowWl && !hasHighWl && (
        <View style={styles.wlWarningLow}>
          <TrendingDown size={14} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.wlWarningLowText}>{t.lowWingLoadingNote}</Text>
        </View>
      )}

      <View style={styles.wlLegend}>
        {(['safe', 'caution', 'risky', 'low'] as WingLoadingSafety[]).map((s) => (
          <View key={s} style={styles.wlLegendItem}>
            <View style={[styles.wlLegendDot, { backgroundColor: SAFETY_COLORS[s] }]} />
            <Text style={styles.wlLegendText}>{t[SAFETY_LABEL_KEYS[s]]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WingLoadingRow({
  detail,
  isFirst,
  weightLbs,
}: {
  detail: SuggestedSizeDetail;
  isFirst: boolean;
  weightLbs: number;
}) {
  const { t } = useLanguage();
  const color = SAFETY_COLORS[detail.safety];
  const barWidth = Math.min(100, (detail.wingLoading / 2.0) * 100);

  return (
    <View style={[styles.wlRow, isFirst && { borderColor: color + '55', backgroundColor: color + '0A' }]}>
      <View style={styles.wlRowTop}>
        <View style={styles.wlRowLeft}>
          {isFirst && <CheckCircle size={13} color={color} strokeWidth={2.5} />}
          <Text style={[styles.wlRowSize, isFirst && { color }]}>{detail.size}</Text>
          <Text style={styles.wlRowSizeUnit}>{t.sqft}</Text>
        </View>
        <View style={styles.wlRowRight}>
          <Text style={[styles.wlRowValue, { color }]}>{detail.wingLoading}</Text>
          <Text style={styles.wlRowValueUnit}>{t.lbSqFt}</Text>
          <SafetyBadge safety={detail.safety} />
        </View>
      </View>
      <View style={styles.wlBarTrack}>
        <View style={[styles.wlBarFill, { width: `${barWidth}%` as any, backgroundColor: color }]} />
        <View style={styles.wlBarMarker} />
      </View>
      <Text style={styles.wlRowCalc}>{weightLbs} lbs ÷ {detail.size} {t.sqft} = {detail.wingLoading}</Text>
    </View>
  );
}

function ResultSection({ result, onReset }: { result: RecommendationResult; onReset: () => void }) {
  const { t } = useLanguage();
  const levelColor = LEVEL_COLORS[result.experienceLevel];
  const levelNameKey = LEVEL_NAME_KEYS[result.experienceLevel] ?? 'beginner';

  return (
    <View style={styles.resultContainer}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultHeading}>{t.yourRecommendation}</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={onReset} activeOpacity={0.7}>
          <RefreshCw size={14} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.resetBtnText}>{t.reset}</Text>
        </TouchableOpacity>
      </View>

      {result.isUnsafe && (
        <View style={styles.unsafeWarning}>
          <AlertTriangle size={18} color={Colors.error} strokeWidth={2} />
          <Text style={styles.unsafeWarningText}>{t.riskyConfigWarning}</Text>
        </View>
      )}

      {result.isBeginner && (
        <View style={styles.beginnerWarning}>
          <AlertTriangle size={18} color={Colors.warning} strokeWidth={2} />
          <Text style={styles.beginnerWarningText}>{t.beginnerHighPerfWarning}</Text>
        </View>
      )}

      <View style={styles.resultCard}>
        <LinearGradient
          colors={[levelColor + '18', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.resultTopRow}>
          <View style={[styles.levelBadge, { backgroundColor: levelColor + '22', borderColor: levelColor + '44' }]}>
            <View style={[styles.levelDot, { backgroundColor: levelColor }]} />
            <Text style={[styles.levelBadgeText, { color: levelColor }]}>{t[levelNameKey]}</Text>
          </View>
          <Text style={styles.weightDisplay}>{result.weightLbs} lbs</Text>
        </View>

        <View style={styles.sizeRangeBlock}>
          <Text style={styles.sizeRangeLabel}>{t.recommendedSizeRange}</Text>
          <View style={styles.sizeRangeRow}>
            <Text style={[styles.sizeRangeValue, { color: levelColor }]}>
              {result.canopySizeMin}–{result.canopySizeMax}
            </Text>
            <Text style={styles.sizeUnit}>{t.sqft}</Text>
          </View>
        </View>

        {result.suggestedSizes.length > 0 && (
          <View style={styles.suggestedBlock}>
            <Text style={styles.suggestedLabel}>{t.suggestedSizes}</Text>
            <View style={styles.suggestedRow}>
              {result.suggestedSizes.map((size, i) => (
                <View key={size} style={[styles.sizePill, i === 0 && { borderColor: levelColor, backgroundColor: levelColor + '18' }]}>
                  {i === 0 && <CheckCircle size={12} color={levelColor} strokeWidth={2.5} />}
                  <Text style={[styles.sizePillText, i === 0 && { color: levelColor }]}>{size}</Text>
                  <Text style={styles.sizePillUnit}>{t.sqft}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <WingLoadingCard result={result} />

      <View style={styles.explanationCard}>
        <View style={styles.explanationHeader}>
          <ShieldCheck size={16} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.explanationTitle}>{t.howCalculated}</Text>
        </View>
        <Text style={styles.explanationText}>
          {t.canopyExplanationIntro} ({t[levelNameKey]}) {t.canopyExplanationRange}{' '}
          <Text style={styles.explanationHighlight}>{result.wingLoadingMin}–{result.wingLoadingMax} {t.lbSqFt}</Text>.
          {'\n\n'}
          {t.canopyExplanationFormula}{'\n'}
          <Text style={styles.explanationHighlight}>{result.weightLbs} lbs ÷ {result.wingLoadingMax} = {result.canopySizeMin} {t.sqft} ({t.canopyExplanationMin})</Text>
          {'\n'}
          <Text style={styles.explanationHighlight}>{result.weightLbs} lbs ÷ {result.wingLoadingMin} = {result.canopySizeMax} {t.sqft} ({t.canopyExplanationMax})</Text>
        </Text>
      </View>

      <View style={styles.mandatoryWarning}>
        <AlertTriangle size={16} color={Colors.warning} strokeWidth={2} />
        <Text style={styles.mandatoryWarningText}>{t.canopySafetyFinal}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1.5,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.hero,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 40,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
  },
  disclaimerText: {
    flex: 1,
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontWeight: '500',
  },
  card: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  weightRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  inputError: {
    borderColor: Colors.error,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: Colors.neonBlue,
  },
  unitBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  unitBtnTextActive: {
    color: Colors.background,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 6,
    lineHeight: 16,
  },
  levelPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelName: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  levelDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingVertical: 14,
    ...Shadow.neonBlue,
  },
  calcBtnDisabled: {
    opacity: 0.7,
  },
  calcBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  resultContainer: {
    marginHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultHeading: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  resetBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  unsafeWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: Colors.errorDim,
    borderWidth: 1.5,
    borderColor: Colors.error + '55',
    borderRadius: Radius.lg,
  },
  unsafeWarningText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  beginnerWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: Colors.warning + '18',
    borderWidth: 1.5,
    borderColor: Colors.warning + '55',
    borderRadius: Radius.lg,
  },
  beginnerWarningText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    gap: Spacing.md,
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  weightDisplay: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  sizeRangeBlock: {
    gap: 4,
  },
  sizeRangeLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sizeRangeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  sizeRangeValue: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  sizeUnit: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  suggestedBlock: {
    gap: 10,
  },
  suggestedLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  suggestedRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  sizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  sizePillText: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  sizePillUnit: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  wlCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    overflow: 'hidden',
    gap: Spacing.md,
    ...Shadow.neonBlueSubtle,
  },
  wlCardHeader: {
    gap: 4,
  },
  wlCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wlCardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  wlFormula: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    marginLeft: 26,
  },
  wlRangeBlock: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  wlRangeLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  wlRangeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  wlRangeValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  wlRangeUnit: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  wlRangeSubRow: {
    gap: 2,
    marginTop: 4,
  },
  wlSubText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  wlSubValue: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  wlDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  wlSuggestedSection: {
    gap: Spacing.sm,
  },
  wlSuggestedTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  wlSuggestedList: {
    gap: Spacing.sm,
  },
  wlRow: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 8,
  },
  wlRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wlRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wlRowSize: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  wlRowSizeUnit: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  wlRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wlRowValue: {
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  wlRowValueUnit: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  wlBarTrack: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  wlBarFill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  wlBarMarker: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'transparent',
  },
  wlRowCalc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  safetyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  safetyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  wlWarningHigh: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.warning + '12',
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.md,
  },
  wlWarningText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 18,
  },
  wlWarningLow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
  },
  wlWarningLowText: {
    flex: 1,
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 18,
  },
  wlLegend: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  wlLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wlLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  wlLegendText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  explanationCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explanationTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  explanationText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  explanationHighlight: {
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  mandatoryWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.lg,
    backgroundColor: Colors.warning + '12',
    borderWidth: 1.5,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.lg,
  },
  mandatoryWarningText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  productsSection: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: -8,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  bottomPad: {
    height: 24,
  },
});
