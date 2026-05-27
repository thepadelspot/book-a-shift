// Supabase Edge Function — sends shift reminder emails at 6pm the day before.
//
// Required secrets (set in Supabase Dashboard → Settings → Edge Functions → Secrets):
//   GMAIL_USER          — the Gmail address to send from  e.g. reminders@gmail.com
//   GMAIL_APP_PASSWORD  — Google App Password (not your normal password).
//                         Generate at myaccount.google.com → Security → App Passwords
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.
//
// Deploy:
//   supabase functions deploy send-shift-reminders --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

const LOGO_URL =
  'https://raw.githubusercontent.com/thepadelspot/book-a-shift/main/src/assets/landscape.png'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Tomorrow in YYYY-MM-DD (Supabase runs on UTC)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    // All confirmed bookings for tomorrow
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('user_id, date, start_time, end_time')
      .eq('date', tomorrowStr)
      .eq('status', 'booked')

    if (bookingsError) throw bookingsError
    if (!bookings?.length) {
      return new Response(JSON.stringify({ message: 'No shifts tomorrow', sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch the relevant users
    const userIds = [...new Set(bookings.map((b) => b.user_id))]
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, firstName')
      .in('id', userIds)

    if (usersError) throw usersError
    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

    // Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: Deno.env.get('GMAIL_USER'),
        pass: Deno.env.get('GMAIL_APP_PASSWORD'),
      },
    })

    const results = await Promise.allSettled(
      bookings.map(async (booking) => {
        const user = userMap[booking.user_id]
        if (!user?.email) return

        const name = user.firstName || 'there'
        const dateLabel = formatDateFull(booking.date)
        const timeLabel = `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`

        await transporter.sendMail({
          from: `Padel Spot <${Deno.env.get('GMAIL_USER')}>`,
          to: user.email,
          subject: `Shift Reminder — Tomorrow, ${dateLabel}`,
          html: buildEmail(name, dateLabel, timeLabel),
        })
      })
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    console.log(`Reminders: ${sent} sent, ${failed} failed`)

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-shift-reminders error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// ── Formatting helpers ────────────────────────────────────────────────────────

function ordinal(n: number): string {
  if (n > 3 && n < 21) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const n = d.getDate()
  return `${days[d.getDay()]} ${n}${ordinal(n)} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(t: string): string {
  const [h] = t.split(':')
  let hour = parseInt(h, 10)
  const suf = hour < 12 ? 'am' : 'pm'
  if (hour === 0) hour = 12
  if (hour > 12) hour -= 12
  return `${hour}${suf}`
}

// ── Email HTML template ───────────────────────────────────────────────────────

function buildEmail(firstName: string, dateLabel: string, timeLabel: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

          <!-- Logo header -->
          <tr>
            <td align="center" style="background:#111111;padding:28px 40px;">
              <img src="${LOGO_URL}" alt="Padel Spot"
                style="height:60px;max-width:240px;display:block;" />
            </td>
          </tr>

          <!-- Title bar -->
          <tr>
            <td align="center" style="background:#3355cc;padding:14px 40px;">
              <p style="margin:0;font-size:15px;font-weight:600;color:#ffffff;letter-spacing:0.05em;text-transform:uppercase;">
                Shift Reminder
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 16px;font-size:17px;color:#222;">Hi ${firstName},</p>
              <p style="margin:0 0 28px;font-size:16px;color:#444;line-height:1.6;">
                This is a friendly reminder that you have a shift scheduled for
                <strong>tomorrow</strong>. Please make sure you arrive on time and ready to go!
              </p>

              <!-- Shift details card -->
              <table cellpadding="0" cellspacing="0" width="100%"
                style="background:#f5f7ff;border-radius:10px;border-left:4px solid #3355cc;padding:0;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Date</p>
                          <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">${dateLabel}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Time</p>
                          <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">${timeLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Contact notice -->
              <table cellpadding="0" cellspacing="0" width="100%"
                style="margin-top:28px;background:#fff8e1;border-radius:8px;border-left:4px solid #f5a623;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:14px;color:#7a5900;line-height:1.6;">
                      <strong>Unable to attend?</strong> Please contact a member of the management team
                      as soon as possible so we can arrange cover.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center"
              style="background:#f8f9fb;padding:20px 40px;border-top:1px solid #e8eaf0;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                © ${new Date().getFullYear()} Padel Spot &nbsp;·&nbsp; This is an automated reminder — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
