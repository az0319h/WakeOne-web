import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const EDGE_CRON_INVOKE_SECRET = Deno.env.get('EDGE_CRON_INVOKE_SECRET');
const CONTRACT_REMINDER_TARGET_URL = Deno.env.get('CONTRACT_REMINDER_TARGET_URL');
const ROUTE_CRON_SECRET =
  Deno.env.get('CONTRACT_REMINDER_CRON_SECRET') ?? Deno.env.get('CRON_SECRET');

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authorization = req.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  if (!EDGE_CRON_INVOKE_SECRET || !token || token !== EDGE_CRON_INVOKE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!CONTRACT_REMINDER_TARGET_URL || !ROUTE_CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const upstream = await fetch(CONTRACT_REMINDER_TARGET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ROUTE_CRON_SECRET}`
    },
    body: '{}'
  });

  const responseBody = await upstream.text();

  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      'Content-Type':
        upstream.headers.get('Content-Type') ?? 'application/json'
    }
  });
});
