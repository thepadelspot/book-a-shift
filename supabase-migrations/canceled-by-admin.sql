-- Add canceled_by_admin flag to bookings so admin-initiated cancellations
-- are not counted against users in their shift stats.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS canceled_by_admin BOOLEAN NOT NULL DEFAULT FALSE;
