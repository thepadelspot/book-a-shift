-- Shift configuration tables
-- Run this in the Supabase SQL editor

-- Weekly default schedule: one row per shift slot per day of week
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
-- start_hour: 0–23 (e.g. 23 = 11pm)
-- duration_hours: length of shift (e.g. 1 = 1 hour, 4 = 4 hours)
-- A shift starting at 23 with duration 4 ends at 03:00 the next day (displayed as "next day")

CREATE TABLE IF NOT EXISTS shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_hour smallint NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  duration_hours smallint NOT NULL CHECK (duration_hours >= 1 AND duration_hours <= 12),
  created_at timestamptz DEFAULT now()
);

-- Per-date overrides: completely replaces the template for that date
-- If any rows exist for a date, they are used instead of the template
CREATE TABLE IF NOT EXISTS shift_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  start_hour smallint NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  duration_hours smallint NOT NULL CHECK (duration_hours >= 1 AND duration_hours <= 12),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS shift_overrides_date_idx ON shift_overrides (date);

-- Enable RLS
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_overrides ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (needed for calendar rendering)
CREATE POLICY "Authenticated users can read shift_templates"
  ON shift_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read shift_overrides"
  ON shift_overrides FOR SELECT
  TO authenticated USING (true);

-- Only admins can write (check roles table)
CREATE POLICY "Admins can insert shift_templates"
  ON shift_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete shift_templates"
  ON shift_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert shift_overrides"
  ON shift_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete shift_overrides"
  ON shift_overrides FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed with current defaults: 7am, 11am, 3pm, 7pm (4h each) for every day of the week
INSERT INTO shift_templates (day_of_week, start_hour, duration_hours) VALUES
  (0, 7, 4), (0, 11, 4), (0, 15, 4), (0, 19, 4),
  (1, 7, 4), (1, 11, 4), (1, 15, 4), (1, 19, 4),
  (2, 7, 4), (2, 11, 4), (2, 15, 4), (2, 19, 4),
  (3, 7, 4), (3, 11, 4), (3, 15, 4), (3, 19, 4),
  (4, 7, 4), (4, 11, 4), (4, 15, 4), (4, 19, 4),
  (5, 7, 4), (5, 11, 4), (5, 15, 4), (5, 19, 4),
  (6, 7, 4), (6, 11, 4), (6, 15, 4), (6, 19, 4);
