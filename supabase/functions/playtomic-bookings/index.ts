// Supabase Edge Function — proxies Playtomic bookings API requests
//
// Required secrets (set in Supabase Dashboard → Settings → Edge Functions → Secrets):
//   PLAYTOMIC_CLIENT_ID     — OAuth client ID
//   PLAYTOMIC_SECRET        — OAuth secret
//   PLAYTOMIC_TENANT_ID     — Tenant ID
//
// Deploy:
//   supabase functions deploy playtomic-bookings --no-verify-jwt

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { startDate, endDate } = await req.json()

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing startDate or endDate' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const clientId = Deno.env.get('PLAYTOMIC_CLIENT_ID')
    const secret = Deno.env.get('PLAYTOMIC_SECRET')
    const tenantId = Deno.env.get('PLAYTOMIC_TENANT_ID')

    if (!clientId || !secret || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing Playtomic credentials' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get OAuth token
    const tokenResponse = await fetch(
      'https://thirdparty.playtomic.io/api/v1/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, secret }),
      }
    )

    if (!tokenResponse.ok) {
      console.error('Failed to get Playtomic token:', tokenResponse.status)
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with Playtomic' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenResponse.json()
    const token = tokenData.token

    // Fetch bookings with token
    const params = new URLSearchParams({
      tenant_id: tenantId,
      start_booking_date: startDate,
      end_booking_date: endDate,
      page: '0',
      size: '100',
    })

    const bookingsResponse = await fetch(
      `https://thirdparty.playtomic.io/api/v1/bookings?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    if (!bookingsResponse.ok) {
      console.error('Failed to fetch bookings:', bookingsResponse.status)
      return new Response(
        JSON.stringify({ error: `Bookings API error: ${bookingsResponse.status}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const bookings = await bookingsResponse.json()
    return new Response(JSON.stringify(bookings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('playtomic-bookings error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
