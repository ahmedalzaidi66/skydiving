import { supabase } from './supabase';
import { getCountryByCode, getCountryByName } from '@/components/CountryPicker';

export type ShippingRule = {
  id: string;
  name: string;
  scope: 'continent' | 'country';
  region: string;
  shipping_type: 'fixed' | 'percentage' | 'free';
  value: number;
  free_threshold: number | null;
  is_enabled: boolean;
};

export type TaxRule = {
  id: string;
  country: string;
  tax_percentage: number;
  tax_label: string;
  is_enabled: boolean;
};

// Map of country → continent for fallback
const COUNTRY_CONTINENT: Record<string, string> = {
  // North America
  'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
  // Europe
  'United Kingdom': 'Europe', 'Germany': 'Europe', 'France': 'Europe', 'Italy': 'Europe',
  'Spain': 'Europe', 'Netherlands': 'Europe', 'Belgium': 'Europe', 'Sweden': 'Europe',
  'Norway': 'Europe', 'Denmark': 'Europe', 'Finland': 'Europe', 'Switzerland': 'Europe',
  'Austria': 'Europe', 'Poland': 'Europe', 'Portugal': 'Europe', 'Greece': 'Europe',
  'Czech Republic': 'Europe', 'Hungary': 'Europe', 'Romania': 'Europe', 'Ukraine': 'Europe',
  // Asia
  'China': 'Asia', 'Japan': 'Asia', 'South Korea': 'Asia', 'India': 'Asia',
  'Indonesia': 'Asia', 'Thailand': 'Asia', 'Vietnam': 'Asia', 'Philippines': 'Asia',
  'Malaysia': 'Asia', 'Singapore': 'Asia', 'Pakistan': 'Asia', 'Bangladesh': 'Asia',
  // Middle East
  'Saudi Arabia': 'Asia', 'UAE': 'Asia', 'Israel': 'Asia', 'Turkey': 'Asia',
  'Iran': 'Asia', 'Iraq': 'Asia', 'Kuwait': 'Asia', 'Qatar': 'Asia',
  // Oceania
  'Australia': 'Oceania', 'New Zealand': 'Oceania',
  // South America
  'Brazil': 'South America', 'Argentina': 'South America', 'Colombia': 'South America',
  'Chile': 'South America', 'Peru': 'South America', 'Venezuela': 'South America',
  // Africa
  'South Africa': 'Africa', 'Nigeria': 'Africa', 'Egypt': 'Africa', 'Kenya': 'Africa',
  'Ethiopia': 'Africa', 'Ghana': 'Africa', 'Morocco': 'Africa', 'Algeria': 'Africa',
};

export function getContinent(country: string): string | null {
  // Accept either English display name or ISO code
  if (COUNTRY_CONTINENT[country]) return COUNTRY_CONTINENT[country];
  // Try resolving ISO code → English name
  const byCode = getCountryByCode(country.toUpperCase());
  if (byCode && COUNTRY_CONTINENT[byCode.en]) return COUNTRY_CONTINENT[byCode.en];
  return null;
}

/**
 * Resolve a country input (ISO code or display name) to the canonical English
 * name used as the key in COUNTRY_CONTINENT and shipping/tax rule lookups.
 */
function resolveCountryName(codeOrName: string, displayName?: string): string {
  // If caller supplied a pre-resolved English display name, prefer it
  if (displayName && displayName.trim()) return displayName.trim();
  // If it looks like an ISO code (2 chars), resolve to English name
  if (codeOrName.length === 2) {
    const c = getCountryByCode(codeOrName.toUpperCase());
    if (c) return c.en;
  }
  // Try matching by English or Arabic name
  const c = getCountryByName(codeOrName);
  if (c) return c.en;
  return codeOrName;
}

export type ShippingTaxResult = {
  shipping: number;
  tax: number;
  taxLabel: string;
  taxPercentage: number;
  freeShipping: boolean;
  shippingRuleName: string | null;
};

export async function calculateShippingAndTax(
  countryCodeOrName: string,
  countryNameOrSubtotal: string | number,
  subtotalArg?: number,
): Promise<ShippingTaxResult> {
  // Support both old 2-arg call (country, subtotal) and new 3-arg call (code, name, subtotal)
  let subtotal: number;
  let resolvedName: string;
  if (typeof countryNameOrSubtotal === 'number') {
    subtotal = countryNameOrSubtotal;
    resolvedName = resolveCountryName(countryCodeOrName);
  } else {
    subtotal = subtotalArg ?? 0;
    resolvedName = resolveCountryName(countryCodeOrName, countryNameOrSubtotal);
  }

  const country = resolvedName;

  const [{ data: shippingRules }, { data: taxRules }] = await Promise.all([
    supabase.from('shipping_rules').select('*').eq('is_enabled', true),
    supabase.from('tax_rules').select('*').eq('is_enabled', true),
  ]);

  const rules: ShippingRule[] = (shippingRules ?? []) as ShippingRule[];
  const taxes: TaxRule[] = (taxRules ?? []) as TaxRule[];

  // Find applicable shipping rule: country rule first, then continent
  const continent = getContinent(country);
  const countryRule = rules.find(
    (r) => r.scope === 'country' && r.region.toLowerCase() === country.toLowerCase()
  );
  const continentRule = continent
    ? rules.find(
        (r) => r.scope === 'continent' && r.region.toLowerCase() === continent.toLowerCase()
      )
    : undefined;

  const activeRule = countryRule ?? continentRule ?? null;

  let shipping = 0;
  let freeShipping = false;
  let shippingRuleName: string | null = null;

  if (activeRule) {
    shippingRuleName = activeRule.name;
    // Check free threshold first
    if (activeRule.free_threshold != null && subtotal >= activeRule.free_threshold) {
      shipping = 0;
      freeShipping = true;
    } else if (activeRule.shipping_type === 'free') {
      shipping = 0;
      freeShipping = true;
    } else if (activeRule.shipping_type === 'fixed') {
      shipping = activeRule.value;
    } else if (activeRule.shipping_type === 'percentage') {
      shipping = Math.round((subtotal * activeRule.value) / 100 * 100) / 100;
    }
  }

  // Find tax rule for this country
  const taxRule = taxes.find(
    (r) => r.country.toLowerCase() === country.toLowerCase()
  );

  let tax = 0;
  let taxLabel = '';
  let taxPercentage = 0;

  if (taxRule && taxRule.tax_percentage > 0) {
    taxPercentage = taxRule.tax_percentage;
    taxLabel = taxRule.tax_label;
    // Tax applied on subtotal + shipping
    tax = Math.round(((subtotal + shipping) * taxPercentage) / 100 * 100) / 100;
  }

  return { shipping, tax, taxLabel, taxPercentage, freeShipping, shippingRuleName };
}
