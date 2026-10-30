// Supabase Edge Function — proxies Playtomic OAuth token requests
//
// Required secrets (set in Supabase Dashboard → Settings → Edge Functions → Secrets):
//   PLAYTOMIC_CLIENT_ID     — OAuth client ID
//   PLAYTOMIC_SECRET        — OAuth secret
//
// Deploy:
//   supabase functions deploy playtomic-token --no-verify-jwt

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const clientId = Deno.env.get('PLAYTOMIC_CLIENT_ID')
    const secret = Deno.env.get('PLAYTOMIC_SECRET')

    if (!clientId || !secret) {
      return new Response(
        JSON.stringify({ error: 'Missing Playtomic credentials' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(
      'https://thirdparty.playtomic.io/api/v1/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, secret }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Playtomic token error:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `Playtomic API error: ${response.status}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('playtomic-token error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
