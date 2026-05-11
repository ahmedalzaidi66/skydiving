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
 * Resize + convert image bytes to WebP using Deno's built-in ImageData API
 * via OffscreenCanvas (available in Deno Deploy / Edge Runtime).
 */
async function resizeToWebP(
  inputBytes: Uint8Array,
  maxDim: number,
): Promise<Uint8Array> {
  // Decode the input image using createImageBitmap (Web API available in Deno Deploy)
  const blob = new Blob([inputBytes]);
  const bitmap = await createImageBitmap(blob);

  const srcW = bitmap.width;
  const srcH = bitmap.height;

  // Compute output dimensions keeping aspect ratio
  let outW = srcW;
  let outH = srcH;
  if (srcW > maxDim || srcH > maxDim) {
    if (srcW >= srcH) {
      outW = maxDim;
      outH = Math.round((srcH / srcW) * maxDim);
    } else {
      outH = maxDim;
      outW = Math.round((srcW / srcH) * maxDim);
    }
  }

  // Draw onto an OffscreenCanvas
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0, outW, outH);

  // Export as WebP
  const outputBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
  const buffer = await outputBlob.arrayBuffer();
  return new Uint8Array(buffer);
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

    const urls: Record<string, string> = {};

    for (const [suffix, maxDim] of SIZE_CONFIGS) {
      const webpBytes = await resizeToWebP(inputBytes, maxDim);
      const path = `${baseKey}-${suffix}.webp`;

      const { data, error: uploadErr } = await serviceClient.storage
        .from(bucket)
        .upload(path, webpBytes, {
          contentType: 'image/webp',
          upsert: false,
          cacheControl: '31536000', // 1 year CDN cache
        });

      if (uploadErr) {
        return jsonResponse({ success: false, error: `Storage error (${suffix}): ${uploadErr.message}` }, 400);
      }

      const { data: urlData } = serviceClient.storage.from(bucket).getPublicUrl(data.path);
      urls[suffix] = urlData.publicUrl;
    }

    return jsonResponse({
      success: true,
      urls,
      // Convenience: publicUrl points to medium for backwards compatibility
      publicUrl: urls.medium,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
