import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = 'search_recent_v1';
const MAX_RECENT = 8;
const DEBOUNCE_MS = 300;

// ─── Recent searches (localStorage on web, AsyncStorage on native) ────────────

async function loadRecent(): Promise<string[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRecent(terms: string[]): Promise<void> {
  try {
    const json = JSON.stringify(terms.slice(0, MAX_RECENT));
    if (Platform.OS === 'web') {
      localStorage.setItem(RECENT_KEY, json);
    } else {
      await AsyncStorage.setItem(RECENT_KEY, json);
    }
  } catch {
    // Non-fatal
  }
}

export async function addRecentSearch(term: string): Promise<void> {
  const trimmed = term.trim();
  if (!trimmed) return;
  const existing = await loadRecent();
  const deduped = [trimmed, ...existing.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())];
  await saveRecent(deduped.slice(0, MAX_RECENT));
}

export async function clearAllRecent(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(RECENT_KEY);
    } else {
      await AsyncStorage.removeItem(RECENT_KEY);
    }
  } catch {
    // Non-fatal
  }
}

// ─── Fuzzy / partial match ────────────────────────────────────────────────────
// Returns true if every character of `query` appears in `text` in order
// (subsequence match), OR if `text` contains `query` as a substring.
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  // Subsequence: every char of q appears in t in order
  if (q.length > 3) {
    let ti = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const idx = t.indexOf(q[qi], ti);
      if (idx === -1) return false;
      ti = idx + 1;
    }
    return true;
  }
  return false;
}

// Score: lower is better (0 = exact, 1 = starts-with, 2 = contains, 3 = fuzzy)
function matchScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  return 3;
}

export type Suggestion = {
  label: string;
  type: 'product' | 'category' | 'brand' | 'gear' | 'recent';
  sublabel?: string;
};

export type SuggestionSource = {
  // Product names (EN + AR)
  productNames: Array<{ en: string; ar?: string | null; category?: string }>;
  // Category names
  categoryNames: string[];
  // Gear listing makes/models/titles
  gearTerms: Array<{ title: string; make?: string | null; model?: string | null }>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSearchSuggestions(
  rawQuery: string,
  source: SuggestionSource,
  active: boolean,
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent on mount
  useEffect(() => {
    loadRecent().then(setRecentSearches);
  }, []);

  const refreshRecent = useCallback(() => {
    loadRecent().then(setRecentSearches);
  }, []);

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      return;
    }

    const q = rawQuery.trim();

    if (!q) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const results: Array<Suggestion & { score: number }> = [];
      const seen = new Set<string>();

      const push = (s: Suggestion, score: number) => {
        const key = `${s.type}:${s.label.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ ...s, score });
        }
      };

      // Product names
      for (const p of source.productNames) {
        const enScore = fuzzyMatch(p.en, q) ? matchScore(p.en, q) : -1;
        const arScore = p.ar && fuzzyMatch(p.ar, q) ? matchScore(p.ar, q) : -1;
        const bestScore = Math.max(enScore, arScore);
        if (bestScore >= 0) {
          push({
            label: p.en,
            type: 'product',
            sublabel: p.category ?? undefined,
          }, bestScore);
        }
      }

      // Categories
      for (const cat of source.categoryNames) {
        if (fuzzyMatch(cat, q)) {
          push({ label: cat, type: 'category' }, matchScore(cat, q));
        }
      }

      // Gear: titles
      for (const g of source.gearTerms) {
        if (g.title && fuzzyMatch(g.title, q)) {
          push({ label: g.title, type: 'gear' }, matchScore(g.title, q));
        }
        // Make + model as "brand/model" suggestions
        if (g.make && fuzzyMatch(g.make, q)) {
          push({ label: g.make, type: 'brand', sublabel: 'Brand' }, matchScore(g.make, q));
        }
        if (g.model && fuzzyMatch(g.model, q)) {
          push({
            label: g.model,
            type: 'brand',
            sublabel: g.make ?? 'Model',
          }, matchScore(g.model, q));
        }
      }

      // Sort by score, deduplicate label regardless of type
      results.sort((a, b) => a.score - b.score);
      setSuggestions(results.slice(0, 8).map(({ score: _s, ...rest }) => rest));
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawQuery, active, source]);

  return { suggestions, recentSearches, loading, refreshRecent };
}
