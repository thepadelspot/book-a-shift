-- Widen the status check constraint to allow 'pending' requests.
-- The original constraint only permitted 'booked' and 'canceled'.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('booked', 'canceled', 'pending'));

-- User weights are session-only (set on the Requests tab per month) and are NOT persisted.
