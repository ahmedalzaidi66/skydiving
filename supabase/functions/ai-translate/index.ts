import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Language code mapping for MyMemory API
const LANG_MAP: Record<string, string> = {
  en: "en",
  ar: "ar",
  es: "es",
  de: "de",
  ru: "ru",
};

interface TranslateRequest {
  texts: Record<string, string>;   // { fieldName: "text to translate" }
  targetLanguages: string[];       // ["ar", "es", "de", "ru"]
  sourceLanguage?: string;         // defaults to "en"
}

interface TranslateResponse {
  translations: Record<string, Record<string, string>>;
  // { ar: { fieldName: "translated text" }, es: { ... } }
}

async function translateText(
  text: string,
  from: string,
  to: string
): Promise<string> {
  if (!text || !text.trim()) return "";
  if (from === to) return text;

  const sourceLang = LANG_MAP[from] ?? from;
  const targetLang = LANG_MAP[to] ?? to;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SkydiversApp/1.0" },
    });

    if (!res.ok) {
      console.error(`MyMemory HTTP ${res.status} for ${from}→${to}`);
      return text; // Fallback: return original
    }

    const data = await res.json();

    if (
      data?.responseStatus === 200 &&
      data?.responseData?.translatedText
    ) {
      return data.responseData.translatedText;
    }

    console.error("MyMemory unexpected response:", JSON.stringify(data).slice(0, 200));
    return text;
  } catch (err) {
    console.error("Translation fetch failed:", err);
    return text;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: TranslateRequest = await req.json();
    const { texts, targetLanguages, sourceLanguage = "en" } = body;

    if (!texts || typeof texts !== "object") {
      return new Response(JSON.stringify({ error: "texts must be an object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return new Response(JSON.stringify({ error: "targetLanguages must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldNames = Object.keys(texts);
    const result: Record<string, Record<string, string>> = {};

    // Translate all fields for all target languages concurrently
    // But rate-limit to avoid overwhelming the free API: batch by language
    for (const lang of targetLanguages) {
      if (lang === sourceLanguage) continue;
      result[lang] = {};

      // Translate fields sequentially per language to stay within free API limits
      for (const field of fieldNames) {
        const sourceText = texts[field];
        if (!sourceText?.trim()) {
          result[lang][field] = "";
          continue;
        }
        result[lang][field] = await translateText(sourceText, sourceLanguage, lang);
        // Small delay between requests to respect rate limits
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    const response: TranslateResponse = { translations: result };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("ai-translate error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
