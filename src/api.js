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

// Book a shift directly (admin use — bypasses the request queue)
export async function bookShift({ user_id, date, start_time, end_time }) {
  const { data, error } = await supabase
    .from('bookings')
    .insert([
      { user_id, date, start_time, end_time, status: 'booked' }
    ]);
  if (error) throw error;
  return data;
}

// Submit a shift request (non-admin users — requires admin approval)
export async function requestShift({ user_id, date, start_time, end_time }) {
  const { data, error } = await supabase
    .from('bookings')
    .insert([{ user_id, date, start_time, end_time, status: 'pending' }]);
  if (error) throw error;
  return data;
}

// Approve a pending request → status becomes 'booked'
export async function approveBooking(booking_id) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'booked' })
    .eq('id', booking_id);
  if (error) throw error;
  return data;
}

// Deny a pending request → mark canceled by admin so it doesn't count against user
export async function denyBooking(booking_id) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'canceled', canceled_at: new Date().toISOString(), canceled_by_admin: true })
    .eq('id', booking_id);
  if (error) throw error;
  return data;
}

// Fetch all pending requests (all users)
export async function fetchPendingRequests() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'pending')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}


// Update a shift's start/end time
export async function updateShift(booking_id, start_time, end_time) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ start_time, end_time })
    .eq('id', booking_id);
  if (error) throw error;
  return data;
}

// Cancel a shift. Pass canceledByAdmin=true when an admin initiates the cancel
// so it is excluded from the user's personal cancellation stats.
export async function cancelShift(booking_id, canceledByAdmin = false) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'canceled', canceled_at: new Date().toISOString(), canceled_by_admin: canceledByAdmin })
    .eq('id', booking_id);
  if (error) throw error;
  return data;
}

// --- Shift configuration ---

// Fetch all weekly shift templates
export async function fetchShiftTemplates() {
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .order('day_of_week')
    .order('start_hour');
  if (error) throw error;
  return data;
}

// Fetch shift overrides for a specific month
export async function fetchShiftOverrides(year, month) {
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('shift_overrides')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date')
    .order('start_hour');
  if (error) throw error;
  return data;
}

// Fetch shift overrides within an arbitrary date range (used by block-shift booking)
export async function fetchShiftOverridesByDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('shift_overrides')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_hour');
  if (error) throw error;
  return data;
}

// Fetch all upcoming shift overrides (from today onwards, for admin panel)
export async function fetchUpcomingShiftOverrides() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('shift_overrides')
    .select('*')
    .gte('date', today)
    .order('date')
    .order('start_hour');
  if (error) throw error;
  return data;
}

// Add a slot to the weekly template
export async function addShiftTemplate(day_of_week, start_hour, duration_hours) {
  const { data, error } = await supabase
    .from('shift_templates')
    .insert([{ day_of_week, start_hour, duration_hours }])
    .select();
  if (error) throw error;
  return data[0];
}

// Remove a slot from the weekly template
export async function deleteShiftTemplate(id) {
  const { error } = await supabase.from('shift_templates').delete().eq('id', id);
  if (error) throw error;
}

// Add a shift override slot for a specific date
export async function addShiftOverride(date, start_hour, duration_hours) {
  const { data, error } = await supabase
    .from('shift_overrides')
    .insert([{ date, start_hour, duration_hours }])
    .select();
  if (error) throw error;
  return data[0];
}

// Remove a single shift override slot
export async function deleteShiftOverride(id) {
  const { error } = await supabase.from('shift_overrides').delete().eq('id', id);
  if (error) throw error;
}

// Remove ALL override slots for a date (resets that date back to the weekly template)
export async function deleteShiftOverridesForDate(date) {
  const { error } = await supabase.from('shift_overrides').delete().eq('date', date);
  if (error) throw error;
}
