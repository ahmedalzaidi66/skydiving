import { supabase } from '@/lib/supabase';

export type UploadResult =
  | { url: string; error: null }
  | { url: null; error: string };

export type UploadFolder = 'products' | 'branding' | 'cms' | 'general';

const BUCKET = 'uploads';

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
  // Verify the shared client has an authenticated session before attempting
  // the upload — storage RLS requires auth.uid() IS NOT NULL.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      url: null,
      error: 'Not authenticated. Please log out and log in again to refresh your session.',
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return { url: null, error: error.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return { url: data.publicUrl, error: null };
}

export async function deleteImageFromSupabase(url: string): Promise<void> {
  try {
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length).split('?')[0];
    await supabase.storage.from(BUCKET).remove([path]);
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
