// Supabase Edge Function — emails management when a user cancels a booked shift.
// Called by the notify_shift_cancellation trigger on bookings
// (see supabase-migrations/cancellation-cutoff.sql) with { booking_id }.
//
// Required secrets (set in Supabase Dashboard → Settings → Edge Functions → Secrets):
//   GMAIL_USER                — the Gmail address to send from (shared with send-shift-reminders)
//   GMAIL_APP_PASSWORD        — Google App Password (shared with send-shift-reminders)
//   CANCELLATION_NOTIFY_EMAIL — optional; recipient(s), comma-separated. Defaults to GMAIL_USER.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.
//
// Deploy:
//   supabase functions deploy notify-shift-cancellation --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

const LOGO_URL =
  'https://raw.githubusercontent.com/thepadelspot/book-a-shift/main/src/assets/landscape.png'

Deno.serve(async (req) => {
  try {
    const { booking_id } = await req.json().catch(() => ({}))
    if (!booking_id) return json({ error: 'booking_id is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Re-read the booking rather than trusting the caller, so this endpoint can
    // only ever report genuine user cancellations.
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, date, start_time, end_time, status, canceled_at, canceled_by_admin')
      .eq('id', booking_id)
      .single()

    if (bookingError) throw bookingError
    if (booking.status !== 'canceled' || booking.canceled_by_admin) {
      return json({ message: 'Not a user cancellation', sent: 0 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('email, firstName, lastName')
      .eq('id', booking.user_id)
      .single()

    const userName =
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Unknown user'
    const dateLabel = formatDateFull(booking.date)
    const timeLabel = `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`
    const noticeLabel = formatNotice(booking.date, booking.start_time, booking.canceled_at)

    const gmailUser = Deno.env.get('GMAIL_USER')!
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: Deno.env.get('GMAIL_APP_PASSWORD') },
    })

    await transporter.sendMail({
      from: `Padel Spot <${gmailUser}>`,
      to: Deno.env.get('CANCELLATION_NOTIFY_EMAIL') || gmailUser,
      replyTo: user?.email || undefined,
      subject: `Shift Cancelled — ${userName}, ${dateLabel} ${timeLabel}`,
      html: buildEmail(userName, user?.email || '', dateLabel, timeLabel, noticeLabel),
    })

    console.log(`Cancellation email sent for booking ${booking.id}`)
    return json({ sent: 1 })
  } catch (err) {
    console.error('notify-shift-cancellation error:', err)
    return json({ error: (err as Error).message }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

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
  const [h, m] = t.split(':')
  let hour = parseInt(h, 10)
  const suf = hour < 12 ? 'am' : 'pm'
  if (hour === 0) hour = 12
  if (hour > 12) hour -= 12
  return m && m !== '00' ? `${hour}:${m}${suf}` : `${hour}${suf}`
}

// Approximate notice given, e.g. "3 days 4 hours". Shift times are UK local and
// Edge Functions run in UTC, so this can be off by an hour during BST — fine
// for an at-a-glance figure.
function formatNotice(dateStr: string, startTime: string, canceledAt: string | null): string {
  const start = new Date(`${dateStr}T${startTime.slice(0, 5)}:00Z`)
  const canceled = canceledAt ? new Date(canceledAt) : new Date()
  const hours = Math.max(0, Math.round((start.getTime() - canceled.getTime()) / 3_600_000))
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  const parts = []
  if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`)
  if (rem || !days) parts.push(`${rem} hour${rem !== 1 ? 's' : ''}`)
  return parts.join(' ')
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

// ── Email HTML template ───────────────────────────────────────────────────────

function detailRow(label: string, value: string, last = false): string {
  return `<tr>
                        <td${last ? '' : ' style="padding-bottom:16px;"'}>
                          <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">${label}</p>
                          <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">${value}</p>
                        </td>
                      </tr>`
}

function buildEmail(
  userName: string,
  userEmail: string,
  dateLabel: string,
  timeLabel: string,
  noticeLabel: string
): string {
  const name = escapeHtml(userName)
  const email = escapeHtml(userEmail)
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
            <td align="center" style="background:#c0392b;padding:14px 40px;">
              <p style="margin:0;font-size:15px;font-weight:600;color:#ffffff;letter-spacing:0.05em;text-transform:uppercase;">
                Shift Cancelled
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 28px;font-size:16px;color:#444;line-height:1.6;">
                <strong>${name}</strong>${email ? ` (${email})` : ''} has cancelled the following shift.
                You may need to arrange cover.
              </p>

              <!-- Shift details card -->
              <table cellpadding="0" cellspacing="0" width="100%"
                style="background:#fff5f5;border-radius:10px;border-left:4px solid #c0392b;padding:0;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      ${detailRow('Date', dateLabel)}
                      ${detailRow('Time', timeLabel)}
                      ${detailRow('Notice given', noticeLabel, true)}
                    </table>
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
                © ${new Date().getFullYear()} Padel Spot &nbsp;·&nbsp; Automated cancellation alert.
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
