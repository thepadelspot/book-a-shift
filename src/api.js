import { supabase } from './supabaseClient';

// Fetch bookings for a month
export async function fetchBookings(year, month) {
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate);
  if (error) throw error;
  return data;
}

// Fetch closed days for a month
export async function fetchClosedDays(year, month) {
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;
  const { data, error } = await supabase
    .from('closed_days')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate);
  if (error) throw error;
  return data;
}

// Book a shift
export async function bookShift({ user_id, date, start_time, end_time }) {
  const { data, error } = await supabase
    .from('bookings')
    .insert([
      { user_id, date, start_time, end_time, status: 'booked' }
    ]);
  if (error) throw error;
  return data;
}

// Cancel a shift
export async function cancelShift(booking_id) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', booking_id);
  if (error) throw error;
  return data;
}
