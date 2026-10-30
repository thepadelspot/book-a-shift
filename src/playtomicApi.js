// Playtomic API integration — proxied through Supabase Edge Functions
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const PLAYTOMIC_TENANT_ID = process.env.REACT_APP_PLAYTOMIC_TENANT_ID;

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Get a valid access token from Playtomic via Supabase Edge Function, using cached token if still valid
 */
export async function getPlaytomicToken() {
  try {
    // Return cached token if still valid
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
      return cachedToken;
    }

    if (!SUPABASE_URL) {
      console.warn('Supabase URL not configured');
      return null;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/playtomic-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Playtomic: token request failed', response.status, error);
      return null;
    }

    const data = await response.json();
    cachedToken = data.token;
    // Set expiry to 5 minutes before actual expiry to be safe
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - (5 * 60 * 1000);
    console.log('Playtomic: Token obtained successfully');

    return cachedToken;
  } catch (error) {
    console.error('Playtomic: Error getting token:', error);
    return null;
  }
}

/**
 * Fetch bookings from Playtomic for a given date range
 * @param {string} startDate - ISO format date string (e.g., '2025-08-01T00:00:00')
 * @param {string} endDate - ISO format date string (e.g., '2025-08-31T23:59:59')
 * @returns {Promise<Array>} Array of booking objects
 */
export async function fetchPlaytomicBookings(startDate, endDate) {
  try {
    if (!PLAYTOMIC_TENANT_ID || !SUPABASE_URL) {
      console.warn('Playtomic: tenant ID or Supabase URL not configured');
      return [];
    }

    console.log('Playtomic: Fetching bookings for', { startDate, endDate });

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/playtomic-bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Playtomic: Bookings request failed', response.status, error);
      return [];
    }

    const bookings = await response.json();
    console.log('Playtomic: Successfully fetched', Array.isArray(bookings) ? bookings.length : 0, 'bookings');
    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    console.error('Playtomic: Fetch error', error);
    return [];
  }
}

/**
 * Check if there's a booking during a given shift time
 * @param {string} shiftDate - Date in YYYY-MM-DD format
 * @param {string} shiftStartTime - Time in HH:MM format
 * @param {string} shiftEndTime - Time in HH:MM format
 * @param {Array} bookings - Array of Playtomic bookings
 * @returns {boolean} True if there's a booking during this shift
 */
export function hasBookingDuringShift(shiftDate, shiftStartTime, shiftEndTime, bookings) {
  if (!bookings || bookings.length === 0) return false;

  const shiftStart = new Date(`${shiftDate}T${shiftStartTime}`);
  const shiftEnd = new Date(`${shiftDate}T${shiftEndTime}`);

  return bookings.some(booking => {
    const bookingStart = new Date(booking.booking_start_date);
    const bookingEnd = new Date(booking.booking_end_date);

    // Check if booking overlaps with shift
    return bookingStart < shiftEnd && bookingEnd > shiftStart && !booking.is_canceled;
  });
}
