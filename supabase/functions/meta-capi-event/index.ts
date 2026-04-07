const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GRAPH_API_VERSION = 'v21.0';

interface UserData {
  em?: string; // email (plain — will be hashed)
  ph?: string; // phone (plain — will be hashed)
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

interface CapiRequest {
  pixel_id: string;
  access_token?: string; // optional, falls back to global secret
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: UserData;
  custom_data?: Record<string, unknown>;
}

async function sha256Hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CapiRequest = await req.json();

    if (!body.pixel_id || !body.event_name || !body.event_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: pixel_id, event_name, event_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = body.access_token || Deno.env.get('META_CONVERSIONS_API_TOKEN');
    if (!accessToken) {
      console.error('No META_CONVERSIONS_API_TOKEN configured');
      return new Response(
        JSON.stringify({ error: 'Meta CAPI token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash user data
    const hashedUserData: Record<string, unknown> = {};
    if (body.user_data.em) {
      hashedUserData.em = [await sha256Hash(body.user_data.em)];
    }
    if (body.user_data.ph) {
      // Normalize phone: remove spaces, ensure starts with country code
      const phone = body.user_data.ph.replace(/[\s\-\(\)]/g, '');
      hashedUserData.ph = [await sha256Hash(phone)];
    }
    if (body.user_data.client_ip_address) {
      hashedUserData.client_ip_address = body.user_data.client_ip_address;
    }
    if (body.user_data.client_user_agent) {
      hashedUserData.client_user_agent = body.user_data.client_user_agent;
    }
    if (body.user_data.fbc) hashedUserData.fbc = body.user_data.fbc;
    if (body.user_data.fbp) hashedUserData.fbp = body.user_data.fbp;

    const eventPayload = {
      data: [
        {
          event_name: body.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: body.event_id,
          action_source: 'website',
          event_source_url: body.event_source_url || undefined,
          user_data: hashedUserData,
          custom_data: body.custom_data || undefined,
        },
      ],
    };

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${body.pixel_id}/events?access_token=${accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    });

    const result = await response.text();
    console.log(`CAPI response for pixel ${body.pixel_id}:`, response.status, result);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'CAPI request failed', status: response.status, detail: result }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, pixel_id: body.pixel_id, response: JSON.parse(result) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('meta-capi-event error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
