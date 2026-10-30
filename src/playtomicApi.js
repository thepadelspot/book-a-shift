// Playtomic API integration
const PLAYTOMIC_BASE_URL = 'https://thirdparty.playtomic.io/api/v1';

let cachedToken = null;
let tokenExpiresAt = null;

// Store credentials - should come from environment variables
const PLAYTOMIC_CLIENT_ID = process.env.REACT_APP_PLAYTOMIC_CLIENT_ID;
const PLAYTOMIC_SECRET = process.env.REACT_APP_PLAYTOMIC_SECRET;
const PLAYTOMIC_TENANT_ID = process.env.REACT_APP_PLAYTOMIC_TENANT_ID;

/**
 * Get a valid access token from Playtomic, using cached token if still valid
 */
export async function getPlaytomicToken() {
  try {
    // Return cached token if still valid
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
      return cachedToken;
    }

    if (!PLAYTOMIC_CLIENT_ID || !PLAYTOMIC_SECRET) {
      console.warn('Playtomic credentials not configured');
      return null;
    }

    const response = await fetch(`${PLAYTOMIC_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAYTOMIC_CLIENT_ID,
        secret: PLAYTOMIC_SECRET,
      }),
    });

    if (!response.ok) {
      console.error('Failed to get Playtomic token:', response.status);
      return null;
    }

    const data = await response.json();
    cachedToken = data.token;
    // Set expiry to 5 minutes before actual expiry to be safe
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - (5 * 60 * 1000);

    return cachedToken;
  } catch (error) {
    console.error('Error getting Playtomic token:', error);
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
    if (!PLAYTOMIC_TENANT_ID) {
      console.warn('Playtomic tenant ID not configured');
      return [];
    }

    const token = await getPlaytomicToken();
    if (!token) {
      console.warn('Could not obtain Playtomic token');
      return [];
    }

    const params = new URLSearchParams({
      tenant_id: PLAYTOMIC_TENANT_ID,
      start_booking_date: startDate,
      end_booking_date: endDate,
      page: 0,
      size: 100, // Fetch up to 100 bookings per page
    });

    const response = await fetch(
      `${PLAYTOMIC_BASE_URL}/bookings?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch Playtomic bookings:', response.status);
      return [];
    }

    const bookings = await response.json();
    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    console.error('Error fetching Playtomic bookings:', error);
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
