-- Migration: allow fractional start_hour (15-min intervals) in shift_templates and shift_overrides
-- Run this in the Supabase SQL editor AFTER shift-config-half-hour.sql

ALTER TABLE shift_templates
  DROP CONSTRAINT IF EXISTS shift_templates_start_hour_check;

ALTER TABLE shift_templates
  ALTER COLUMN start_hour TYPE numeric(4,2);

ALTER TABLE shift_templates
  ADD CONSTRAINT shift_templates_start_hour_check
    CHECK (start_hour >= 0 AND start_hour < 24);

ALTER TABLE shift_overrides
  DROP CONSTRAINT IF EXISTS shift_overrides_start_hour_check;

ALTER TABLE shift_overrides
  ALTER COLUMN start_hour TYPE numeric(4,2);

ALTER TABLE shift_overrides
  ADD CONSTRAINT shift_overrides_start_hour_check
    CHECK (start_hour >= 0 AND start_hour < 24);
