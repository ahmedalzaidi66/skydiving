export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type WingLoadingSafety = 'safe' | 'caution' | 'risky' | 'low';

export type SuggestedSizeDetail = {
  size: number;
  wingLoading: number;
  safety: WingLoadingSafety;
};

export type RecommendationResult = {
  experienceLevel: ExperienceLevel;
  wingLoadingMin: number;
  wingLoadingMax: number;
  wingLoadingAtMinSize: number;
  wingLoadingAtMaxSize: number;
  canopySizeMin: number;
  canopySizeMax: number;
  suggestedSizes: number[];
  suggestedSizeDetails: SuggestedSizeDetail[];
  weightLbs: number;
  isUnsafe: boolean;
  isBeginner: boolean;
};

export const STANDARD_CANOPY_SIZES = [79, 84, 89, 96, 103, 109, 120, 126, 135, 150, 170, 190, 210, 230, 260, 280];

const WING_LOADING_RANGES: Record<ExperienceLevel, { min: number; max: number }> = {
  Beginner: { min: 0.6, max: 0.8 },
  Intermediate: { min: 0.8, max: 1.0 },
  Advanced: { min: 1.0, max: 1.2 },
  Expert: { min: 1.2, max: 1.4 },
};

export function getExperienceLevel(jumps: number): ExperienceLevel {
  if (jumps <= 100) return 'Beginner';
  if (jumps <= 300) return 'Intermediate';
  if (jumps <= 500) return 'Advanced';
  return 'Expert';
}

export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

export function getWingLoadingSafety(
  wl: number,
  safeMin: number,
  safeMax: number
): WingLoadingSafety {
  if (wl < safeMin * 0.9) return 'low';
  if (wl <= safeMax) return 'safe';
  if (wl <= safeMax * 1.15) return 'caution';
  return 'risky';
}

export function findClosestSizes(targetMin: number, targetMax: number, count: number = 3): number[] {
  const midpoint = (targetMin + targetMax) / 2;

  return [...STANDARD_CANOPY_SIZES]
    .filter((size) => size >= targetMin * 0.85 && size <= targetMax * 1.15)
    .sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))
    .slice(0, count);
}

export function calculateRecommendation(
  weightInput: number,
  unit: 'lbs' | 'kg',
  jumps: number
): RecommendationResult {
  const weightLbs = unit === 'kg' ? kgToLbs(weightInput) : weightInput;
  const experienceLevel = getExperienceLevel(jumps);
  const range = WING_LOADING_RANGES[experienceLevel];

  const canopySizeMin = Math.round(weightLbs / range.max);
  const canopySizeMax = Math.round(weightLbs / range.min);

  const wingLoadingAtMinSize = parseFloat((weightLbs / canopySizeMin).toFixed(2));
  const wingLoadingAtMaxSize = parseFloat((weightLbs / canopySizeMax).toFixed(2));

  const suggestedSizes = findClosestSizes(canopySizeMin, canopySizeMax);

  const suggestedSizeDetails: SuggestedSizeDetail[] = suggestedSizes.map((size) => {
    const wl = parseFloat((weightLbs / size).toFixed(2));
    return {
      size,
      wingLoading: wl,
      safety: getWingLoadingSafety(wl, range.min, range.max),
    };
  });

  const avgWingLoading = weightLbs / ((canopySizeMin + canopySizeMax) / 2);
  const isUnsafe = avgWingLoading > range.max * 1.15;

  return {
    experienceLevel,
    wingLoadingMin: range.min,
    wingLoadingMax: range.max,
    wingLoadingAtMinSize,
    wingLoadingAtMaxSize,
    canopySizeMin,
    canopySizeMax,
    suggestedSizes,
    suggestedSizeDetails,
    weightLbs: Math.round(weightLbs),
    isUnsafe,
    isBeginner: experienceLevel === 'Beginner',
  };
}
