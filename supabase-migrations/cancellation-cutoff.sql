-- 1. Block non-admins from cancelling a booked shift within 48 hours of its start.
-- 2. Email management (via the notify-shift-cancellation edge function) whenever
--    a user cancels a booked shift.
-- Run this once in the Supabase SQL editor.
--
-- Prerequisites:
--   1. Deploy the edge function first:
--        supabase functions deploy notify-shift-cancellation --no-verify-jwt
--
--   2. Secrets (Supabase Dashboard → Settings → Edge Functions → Secrets):
--        GMAIL_USER, GMAIL_APP_PASSWORD  — already set for send-shift-reminders
--        CANCELLATION_NOTIFY_EMAIL       — optional; who receives the alert.
--                                          Comma-separate for several. Defaults to GMAIL_USER.
--
--   3. Replace YOUR_ANON_KEY below with the value from
--      Supabase Dashboard → Settings → API → anon / public key.
--
-- Shift dates/times are stored as UK local time, so they are converted with
-- Europe/London before comparing against now().

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 48-hour cancellation cutoff ──────────────────────────────────────────────
-- SECURITY DEFINER so the roles lookup isn't affected by RLS on the roles table.
-- Service-role / SQL editor calls (auth.uid() IS NULL) are not restricted.
CREATE OR REPLACE FUNCTION enforce_cancellation_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'booked'
     AND NEW.status = 'canceled'
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin')
     AND ((NEW.date + NEW.start_time) AT TIME ZONE 'Europe/London') < now() + interval '48 hours'
  THEN
    RAISE EXCEPTION 'CANCELLATION_CUTOFF: shifts cannot be cancelled within 48 hours of the start time';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cancellation_cutoff ON bookings;
CREATE TRIGGER enforce_cancellation_cutoff
  BEFORE UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_cancellation_cutoff();

-- ── Cancellation notification email ──────────────────────────────────────────
-- Fires only for user-initiated cancellations of booked shifts (not admin
-- cancellations, and not withdrawn/denied pending requests).
-- net.http_post is queued and sent after the transaction commits, so a
-- rolled-back cancellation never sends an email.
CREATE OR REPLACE FUNCTION notify_shift_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://ajxcfdcwzakfpvpkfpsy.supabase.co/functions/v1/notify-shift-cancellation',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body    := jsonb_build_object('booking_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_shift_cancellation ON bookings;
CREATE TRIGGER notify_shift_cancellation
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  WHEN (OLD.status = 'booked' AND NEW.status = 'canceled' AND NOT NEW.canceled_by_admin)
  EXECUTE FUNCTION notify_shift_cancellation();

-- To check requests were sent:  SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
-- To remove:
--   DROP TRIGGER IF EXISTS enforce_cancellation_cutoff ON bookings;
--   DROP TRIGGER IF EXISTS notify_shift_cancellation ON bookings;
