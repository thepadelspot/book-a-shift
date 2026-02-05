import { supabase } from './supabaseClient';

// Fetch all upcoming shifts for a user
export async function fetchUserShifts(user_id) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'booked')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

// Fetch bookings for a month

export async function fetchBookings(year, month) {
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
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
  const lastDay = new Date(year, month + 1, 0).getDate();
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
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
