import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-admin-token, x-upload-folder, x-file-name, x-content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get('x-admin-token');
    if (!adminToken) {
      return json({ success: false, error: 'Unauthorized: missing admin token' }, 401);
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: validAdmin, error: tokenErr } = await serviceClient.rpc('verify_admin_token', { p_token: adminToken });
    if (tokenErr || !validAdmin) {
      return json({ success: false, error: 'Unauthorized: invalid admin token' }, 401);
    }

    const folder = req.headers.get('x-upload-folder') ?? 'general';
    const fileName = req.headers.get('x-file-name') ?? 'upload.jpg';
    const contentType = req.headers.get('x-content-type') ?? 'application/octet-stream';

    // Route to correct bucket based on folder
    const bucketMap: Record<string, string> = {
      products: 'product-images',
      branding: 'product-images',
      cms:      'product-images',
      general:  'uplods',
      tryon:    'tryon-models',
    };
    const bucket = bucketMap[folder] ?? 'uplods';

    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'jpg';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const fileBuffer = await req.arrayBuffer();
    if (fileBuffer.byteLength === 0) {
      return json({ success: false, error: 'Empty file body received' }, 400);
    }

    const { data, error: uploadErr } = await serviceClient.storage
      .from(bucket)
      .upload(path, fileBuffer, { contentType, upsert: false });

    if (uploadErr) {
      return json({ success: false, error: `Storage error (bucket: ${bucket}): ${uploadErr.message}` }, 400);
    }

    const { data: urlData } = serviceClient.storage.from(bucket).getPublicUrl(data.path);

    return json({ success: true, publicUrl: urlData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return json({ success: false, error: msg }, 500);
  }
});
