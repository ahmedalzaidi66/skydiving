const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type TranslateTexts = Record<string, string>;
export type TranslateResult = Record<string, Record<string, string>>;
// { ar: { name: "...", description: "..." }, es: { ... }, de: { ... }, ru: { ... } }

const TARGET_LANGUAGES = ['ar', 'es', 'de', 'ru'];

/**
 * Calls the ai-translate edge function to translate a set of named text fields
 * from English into all other supported languages.
 *
 * Returns a map of { languageCode: { fieldName: translatedText } }.
 * Never throws — returns empty object on failure so callers can degrade gracefully.
 */
export async function autoTranslate(
  texts: TranslateTexts,
  targetLanguages: string[] = TARGET_LANGUAGES
): Promise<TranslateResult> {
  // Filter out empty fields — no point sending blanks to the API
  const nonEmpty: TranslateTexts = {};
  for (const [k, v] of Object.entries(texts)) {
    if (v && v.trim()) nonEmpty[k] = v.trim();
  }
  if (Object.keys(nonEmpty).length === 0) return {};

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/ai-translate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          Apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          texts: nonEmpty,
          targetLanguages,
          sourceLanguage: 'en',
        }),
      }
    );

    if (!res.ok) {
      console.warn('ai-translate HTTP error:', res.status, await res.text());
      return {};
    }

    const data = await res.json();
    return (data?.translations as TranslateResult) ?? {};
  } catch (err) {
    console.warn('autoTranslate failed:', err);
    return {};
  }
}
