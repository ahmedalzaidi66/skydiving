import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // x-admin-token must be listed here or browsers strip it before the POST fires
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-admin-token',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get('x-admin-token');
    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: validAdmin } = await serviceClient.rpc('verify_admin_token', {
      p_token: adminToken,
    });

    if (!validAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, email, password, auth_user_id, full_name } = body;

    // ── ensure_auth_user ──────────────────────────────────────────────────────
    // Creates or updates a Supabase Auth account for a legacy employee.
    // password here is the employee's REAL login password (not the session token),
    // so signInWithPassword(email, realPassword) works directly after this call.
    if (action === 'ensure_auth_user') {
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'email and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const emailLower = email.trim().toLowerCase();

      const { data: listData } = await serviceClient.auth.admin.listUsers();
      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === emailLower
      );

      let authUserId: string;

      if (existing) {
        await serviceClient.auth.admin.updateUserById(existing.id, { password });
        authUserId = existing.id;
      } else {
        const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
          email: emailLower,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name ?? '' },
        });
        if (createErr || !created?.user) {
          return new Response(JSON.stringify({ error: createErr?.message ?? 'Failed to create auth user' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        authUserId = created.user.id;
      }

      await serviceClient
        .from('employees')
        .update({ auth_user_id: authUserId })
        .eq('email', emailLower);

      return new Response(JSON.stringify({ auth_user_id: authUserId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── create ────────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { data: existing } = await serviceClient.auth.admin.listUsers();
      const alreadyExists = existing?.users?.some(
        (u) => u.email?.toLowerCase() === email?.toLowerCase()
      );
      if (alreadyExists) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await serviceClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? '' },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ auth_user_id: data.user.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── update_password ───────────────────────────────────────────────────────
    if (action === 'update_password') {
      if (!auth_user_id || !password) {
        return new Response(JSON.stringify({ error: 'auth_user_id and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await serviceClient.auth.admin.updateUserById(auth_user_id, { password });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!auth_user_id) {
        return new Response(JSON.stringify({ error: 'auth_user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await serviceClient.auth.admin.deleteUser(auth_user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
