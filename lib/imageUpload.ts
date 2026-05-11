import { supabase } from '@/lib/supabase';

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

/**
 * Upload an image through the image-optimize edge function.
 * Returns three WebP sizes: thumb (240px), medium (800px), full (1920px).
 * Falls back to direct storage upload for SVGs and non-optimizable types.
 */
export async function uploadImageToSupabase(
  file: File,
  folder: UploadFolder = 'general',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { url: null, urls: null, error: 'Not authenticated. Please log out and log in again.' };
  }

  // SVGs and GIFs bypass optimization (upload direct)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return uploadDirect(file, folder, sessionData.session.access_token);
  }

  onProgress?.(10);

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
    const endpoint = `${supabaseUrl}/functions/v1/image-optimize`;

    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(30);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        Apikey: anonKey,
        'x-upload-folder': folder,
        'x-file-name': file.name,
      },
      body: arrayBuffer,
    });

    onProgress?.(85);

    const result = await response.json();

    if (!result.success) {
      return { url: null, urls: null, error: result.error ?? 'Optimization failed' };
    }

    onProgress?.(100);

    const urls: ImageUrls = result.urls;
    return { url: urls.medium, urls, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return { url: null, urls: null, error: msg };
  }
}

async function uploadDirect(
  file: File,
  folder: UploadFolder,
  _accessToken: string,
): Promise<UploadResult> {
  const bucket = BUCKET_MAP[folder];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) {
    return { url: null, urls: null, error: `Storage error (bucket: ${bucket}): ${error.message}` };
  }

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
