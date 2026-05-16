import { supabase } from '@/lib/supabase';
import { captureError } from '@/lib/sentry';

export type ImageUrls = {
  thumb: string;
  medium: string;
  full: string;
};

export type UploadResult =
  | { url: string; urls: ImageUrls; error: null }
  | { url: null; urls: null; error: string };

export type UploadFolder =
  | 'products'
  | 'branding'
  | 'cms'
  | 'general'
  | 'tryon'
  | 'hero-slides'
  | 'used-gear'
  | 'categories'
  | 'avatars';

const BUCKET_MAP: Record<UploadFolder, string> = {
  products:      'product-images',
  branding:      'product-images',
  cms:           'product-images',
  'hero-slides': 'product-images',
  categories:    'product-images',
  general:       'uplods',
  'used-gear':   'uplods',
  avatars:       'uplods',
  tryon:         'tryon-models',
};

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

const MAX_SIZE_MB = 20;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, SVG, or GIF.`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File too large (max ${MAX_SIZE_MB} MB).`;
  }
  return null;
}

// Edge function timeout — if it doesn't respond in 25s, fall back to direct upload.
const EDGE_TIMEOUT_MS = 25_000;

/**
 * Upload an image through the image-optimize edge function (WebP resize, 3 sizes).
 * Falls back to direct storage upload if the edge function times out or errors.
 */
export async function uploadImageToSupabase(
  file: File,
  folder: UploadFolder = 'general',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { url: null, urls: null, error: 'Not authenticated. Please log in again.' };
  }

  // SVGs and GIFs skip optimization
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return uploadDirect(file, folder, onProgress);
  }

  onProgress?.(10);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const endpoint = `${supabaseUrl}/functions/v1/image-optimize`;

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err: unknown) {
    return { url: null, urls: null, error: 'Failed to read file: ' + (err instanceof Error ? err.message : String(err)) };
  }
  onProgress?.(30);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        Apikey: anonKey,
        'x-upload-folder': folder,
        'x-file-name': file.name,
      },
      body: arrayBuffer,
    });
    clearTimeout(timeoutId);
    onProgress?.(85);

    let result: any;
    try {
      result = await response.json();
    } catch {
      // Non-JSON response from edge function — fall back to direct upload
      console.error('[imageUpload] edge function returned non-JSON, status:', response.status, '— falling back to direct upload');
      return uploadDirect(file, folder, onProgress);
    }

    if (!result.success) {
      console.error('[imageUpload] edge function error:', result.error, '| status:', response.status, '— falling back to direct upload');
      captureError(new Error(result.error ?? 'Optimization failed'), { action: 'image_upload/optimize', extra: { folder, status: response.status } });
      return uploadDirect(file, folder, onProgress);
    }

    onProgress?.(100);
    const urls: ImageUrls = result.urls;
    return { url: urls.medium, urls, error: null };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('[imageUpload] edge function', isTimeout ? 'timed out' : 'threw:', err, '— falling back to direct upload');
    captureError(err, { action: 'image_upload/optimize', extra: { folder, isTimeout } });
    return uploadDirect(file, folder, onProgress);
  }
}

async function uploadDirect(
  file: File,
  folder: UploadFolder,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const bucket = BUCKET_MAP[folder];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  onProgress?.(50);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error('[imageUpload] direct upload failed:', { bucket, filename, error: error.message });
    return { url: null, urls: null, error: `Storage upload failed (${bucket}): ${error.message}` };
  }

  onProgress?.(100);
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  const url = data.publicUrl;
  return { url, urls: { thumb: url, medium: url, full: url }, error: null };
}

export async function deleteImageFromSupabase(url: string): Promise<void> {
  try {
    const buckets = [...new Set(Object.values(BUCKET_MAP))];
    for (const bucket of buckets) {
      const marker = `/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        const path = url.slice(idx + marker.length).split('?')[0];
        await supabase.storage.from(bucket).remove([path]);
        return;
      }
    }
  } catch {
    // Non-fatal
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Pick the best URL for a given display context.
 * Accepts either a plain string URL or an ImageUrls object.
 */
export function pickImageUrl(
  source: string | ImageUrls | null | undefined,
  size: 'thumb' | 'medium' | 'full' = 'medium',
): string {
  if (!source) return '';
  if (typeof source === 'string') return source;
  return source[size] || source.medium || source.full || '';
}
