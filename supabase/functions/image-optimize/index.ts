import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-admin-token, x-upload-folder, x-file-name',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Size configs: [suffix, maxDimension]
const SIZE_CONFIGS: Array<[string, number]> = [
  ['thumb', 240],
  ['medium', 800],
  ['full', 1920],
];

const BUCKET_MAP: Record<string, string> = {
  products:      'product-images',
  branding:      'product-images',
  cms:           'product-images',
  'hero-slides': 'product-images',
  general:       'uplods',
  tryon:         'tryon-models',
  'used-gear':   'uplods',
  categories:    'product-images',
  avatars:       'uplods',
};

/**
 * Attempt to resize + convert to WebP using createImageBitmap + OffscreenCanvas.
 * Returns null if the APIs are unavailable or fail, so the caller can store
 * the original bytes as a fallback.
 */
async function tryResizeToWebP(
  inputBytes: Uint8Array,
  maxDim: number,
): Promise<Uint8Array | null> {
  try {
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      return null;
    }

    const blob = new Blob([inputBytes]);
    const bitmap = await createImageBitmap(blob);

    let outW = bitmap.width;
    let outH = bitmap.height;
    if (outW > maxDim || outH > maxDim) {
      if (outW >= outH) {
        outH = Math.round((outH / outW) * maxDim);
        outW = maxDim;
      } else {
        outW = Math.round((outW / outH) * maxDim);
        outH = maxDim;
      }
    }

    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0, outW, outH);

    const outputBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
    const buffer = await outputBlob.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth: accept either admin token or regular JWT bearer
    const adminToken = req.headers.get('x-admin-token');
    const authHeader = req.headers.get('Authorization');

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let isAuthorized = false;

    if (adminToken) {
      const { data: validAdmin } = await serviceClient.rpc('verify_admin_token', { p_token: adminToken });
      isAuthorized = !!validAdmin;
    } else if (authHeader?.startsWith('Bearer ')) {
      // Validate JWT via user client
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      isAuthorized = !!user;
    }

    if (!isAuthorized) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const folder = req.headers.get('x-upload-folder') ?? 'general';
    const originalName = req.headers.get('x-file-name') ?? 'upload.jpg';
    const bucket = BUCKET_MAP[folder] ?? 'product-images';

    const fileBuffer = await req.arrayBuffer();
    if (fileBuffer.byteLength === 0) {
      return jsonResponse({ success: false, error: 'Empty file body' }, 400);
    }

    // Max 20 MB input
    if (fileBuffer.byteLength > 20 * 1024 * 1024) {
      return jsonResponse({ success: false, error: 'File too large (max 20 MB)' }, 400);
    }

    const inputBytes = new Uint8Array(fileBuffer);
    const baseKey = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const originalExt = originalName.split('.').pop()?.toLowerCase() ?? 'jpg';

    const urls: Record<string, string> = {};

    for (const [suffix, maxDim] of SIZE_CONFIGS) {
      const webpBytes = await tryResizeToWebP(inputBytes, maxDim);

      let uploadBytes: Uint8Array;
      let contentType: string;
      let ext: string;

      if (webpBytes) {
        uploadBytes = webpBytes;
        contentType = 'image/webp';
        ext = 'webp';
      } else {
        // Optimization unavailable — store original bytes for this size slot
        uploadBytes = inputBytes;
        contentType = 'application/octet-stream';
        ext = originalExt;
      }

      const path = `${baseKey}-${suffix}.${ext}`;
      const { data, error: uploadErr } = await serviceClient.storage
        .from(bucket)
        .upload(path, uploadBytes, { contentType, upsert: false, cacheControl: '31536000' });

      if (uploadErr) {
        return jsonResponse({ success: false, error: `Storage error (${suffix}): ${uploadErr.message}` }, 400);
      }

      const { data: urlData } = serviceClient.storage.from(bucket).getPublicUrl(data.path);
      urls[suffix] = urlData.publicUrl;
    }

    return jsonResponse({ success: true, urls, publicUrl: urls.medium });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
