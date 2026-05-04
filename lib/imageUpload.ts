import { supabase } from '@/lib/supabase';

export type UploadResult =
  | { url: string; error: null }
  | { url: null; error: string };

export type UploadFolder = 'products' | 'branding' | 'cms' | 'general' | 'tryon';

// Bucket routing — maps upload folder to the actual Supabase storage bucket name
const BUCKET_MAP: Record<UploadFolder, string> = {
  products: 'product-images',
  branding: 'product-images',
  cms:      'product-images',
  general:  'uplods',
  tryon:    'tryon-models',
};

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

const MAX_SIZE_MB = 10;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, SVG, or GIF.`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File too large (max ${MAX_SIZE_MB} MB).`;
  }
  return null;
}

export async function uploadImageToSupabase(
  file: File,
  folder: UploadFolder = 'general',
): Promise<UploadResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      url: null,
      error: 'Not authenticated. Please log out and log in again to refresh your session.',
    };
  }

  const bucket = BUCKET_MAP[folder];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return { url: null, error: `Storage error (bucket: ${bucket}): ${error.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return { url: data.publicUrl, error: null };
}

export async function deleteImageFromSupabase(url: string): Promise<void> {
  try {
    // Determine bucket from URL path
    const buckets = Object.values(BUCKET_MAP);
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
