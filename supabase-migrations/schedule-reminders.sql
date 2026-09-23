-- Schedule nightly shift reminder emails at 18:00 UTC (6pm GMT / 7pm BST).
-- Run this once in the Supabase SQL editor.
--
-- Prerequisites:
--   1. Deploy the edge function first:
--        supabase functions deploy send-shift-reminders --no-verify-jwt
--      OR in the Supabase dashboard: Edge Functions → send-shift-reminders → disable "Verify JWT"
--
--   2. Set these secrets in Supabase Dashboard → Settings → Edge Functions → Secrets:
--        GMAIL_USER         = your-gmail@gmail.com
--        GMAIL_APP_PASSWORD = the 16-character app password from Google
--
--   3. Replace YOUR_ANON_KEY below with the value from
--      Supabase Dashboard → Settings → API → anon / public key.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'send-shift-reminders',   -- job name (must be unique)
  '0 18 * * *',             -- every day at 18:00 UTC
                            -- change to '0 17 * * *' for 6pm BST (summer)
  $$
  SELECT net.http_post(
    url     := 'https://ajxcfdcwzakfpvpkfpsy.supabase.co/functions/v1/send-shift-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To check the job ran:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- To remove the job:      SELECT cron.unschedule('send-shift-reminders');
-- To change the time:     SELECT cron.alter_job(job_id, schedule := '0 17 * * *') FROM cron.job WHERE jobname = 'send-shift-reminders';
