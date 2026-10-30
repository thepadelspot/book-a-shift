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
// Also automatically deny any conflicting requests for the same shift
export async function approveBooking(booking_id) {
  try {
    // First, fetch the booking to get its date and time info
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('date, start_time, end_time')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) throw fetchError;

    // Update the approved booking
    const { error: approveError } = await supabase
      .from('bookings')
      .update({ status: 'booked' })
      .eq('id', booking_id);

    if (approveError) throw approveError;

    // Helper function to convert time string to minutes since midnight
    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // Helper function to check if two time ranges overlap
    const timesOverlap = (start1, end1, start2, end2) => {
      const s1 = timeToMinutes(start1);
      const e1 = timeToMinutes(end1);
      const s2 = timeToMinutes(start2);
      const e2 = timeToMinutes(end2);

      // Handle overnight shifts: if end < start, it crosses midnight
      if (e1 < s1) {
        // Overnight shift: overlaps if start2 >= s1 OR end2 >= e1 (relative to next day)
        return s2 >= s1 || e2 > 0;
      }
      if (e2 < s2) {
        // Other shift is overnight: overlaps if s1 < e2 OR e1 >= s2
        return s1 < e2 || e1 >= s2;
      }

      // Normal case: ranges overlap if s1 < e2 and s2 < e1
      return s1 < e2 && s2 < e1;
    };

    // Auto-deny any pending bookings that conflict with this shift (same date and overlapping times)
    const { data: allPending, error: findError } = await supabase
      .from('bookings')
      .select('id, start_time, end_time')
      .eq('date', booking.date)
      .eq('status', 'pending')
      .neq('id', booking_id);

    if (findError) throw findError;

    // Filter for actual conflicts
    const conflicting = allPending?.filter(p =>
      timesOverlap(booking.start_time, booking.end_time, p.start_time, p.end_time)
    ) || [];

    // Deny all conflicting bookings
    if (conflicting && conflicting.length > 0) {
      const { error: denyError } = await supabase
        .from('bookings')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), canceled_by_admin: true })
        .in('id', conflicting.map(b => b.id));

      if (denyError) throw denyError;
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
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

// Handle check-in with late arrival adjustments
export async function handleCheckIn(booking_id, checkInTime, latitude, longitude) {
  try {
    // Fetch the booking to get its details
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, user_id')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) throw fetchError;

    // Convert times to minutes for comparison
    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const minutesToTime = (minutes) => {
      const h = String(Math.floor(minutes / 60)).padStart(2, '0');
      const m = String(minutes % 60).padStart(2, '0');
      return `${h}:${m}`;
    };

    const scheduledStartMinutes = timeToMinutes(booking.start_time);
    const checkInMinutes = timeToMinutes(checkInTime);

    let newStartTime = booking.start_time;
    let updatesToMake = [
      {
        id: booking_id,
        updates: {
          checked_in_at: new Date().toISOString(),
          checkin_latitude: latitude,
          checkin_longitude: longitude,
        }
      }
    ];

    // Only adjust start time if checked in LATE (after scheduled start)
    if (checkInMinutes > scheduledStartMinutes) {
      newStartTime = checkInTime;
      updatesToMake[0].updates.start_time = checkInTime;

      // Find the person scheduled to end at this time and update their end time
      const { data: previousShift, error: prevError } = await supabase
        .from('bookings')
        .select('id, end_time')
        .eq('date', booking.date)
        .eq('status', 'booked')
        .neq('id', booking_id)
        .order('end_time', { ascending: false })
        .limit(1);

      if (!prevError && previousShift && previousShift.length > 0) {
        // Update the previous person's end time to match this person's check-in time
        updatesToMake.push({
          id: previousShift[0].id,
          updates: { end_time: checkInTime }
        });
      }
    }

    // Apply all updates
    for (const update of updatesToMake) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update(update.updates)
        .eq('id', update.id);

      if (updateError) throw updateError;
    }

    return { success: true, adjustedTime: newStartTime };
  } catch (error) {
    throw error;
  }
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
