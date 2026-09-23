-- Migration: allow half-hour (0.5) durations in shift_templates and shift_overrides
-- Run this in the Supabase SQL editor

-- Drop the integer constraints and change to numeric(4,2) to support 0.5 increments

ALTER TABLE shift_templates
  DROP CONSTRAINT IF EXISTS shift_templates_duration_hours_check;

ALTER TABLE shift_templates
  ALTER COLUMN duration_hours TYPE numeric(4,2);

ALTER TABLE shift_templates
  ADD CONSTRAINT shift_templates_duration_hours_check
    CHECK (duration_hours >= 0.25 AND duration_hours <= 12);

ALTER TABLE shift_overrides
  DROP CONSTRAINT IF EXISTS shift_overrides_duration_hours_check;

ALTER TABLE shift_overrides
  ALTER COLUMN duration_hours TYPE numeric(4,2);

ALTER TABLE shift_overrides
  ADD CONSTRAINT shift_overrides_duration_hours_check
    CHECK (duration_hours >= 0.25 AND duration_hours <= 12);
