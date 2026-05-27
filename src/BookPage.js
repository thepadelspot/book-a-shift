import React, { useState, useEffect, useRef } from 'react';
import Calendar from './Calendar';
import { fetchBookings, fetchClosedDays, bookShift, requestShift, cancelShift, updateShift, fetchShiftTemplates, fetchShiftOverrides } from './api';
import { supabase } from './supabaseClient';
import AdminClosedDays from './AdminClosedDays';
import AdminUserStats from './AdminUserStats';
import ConfirmModal from './ConfirmModal';
import { buildShiftConfigMap, formatShiftTime, computeEndTime, decimalHourToTimeStr, startTimeToDecimal } from './utils/shiftConfig';

// Compute duration in hours from stored start_time / end_time strings (handles midnight crossing)
function bookingDuration(start_time, end_time) {
  const s = startTimeToDecimal(start_time);
  const e = startTimeToDecimal(end_time);
  return e > s ? e - s : 24 - s + e;
}

// For demo, store bookings in state
const initialBookings = {};



const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const BookPage = ({ user, darkMode }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfos, setUserInfos] = useState({});
  // Check if user is admin and fetch user emails
  useEffect(() => {
    let isMounted = true;
    if (!user?.id) return;
    supabase
      .from('roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (isMounted) setIsAdmin(data?.role === 'admin');
      });
    // Fetch all user info for admin
    supabase
      .from('users')
      .select('id, email, firstName, lastName')
      .then(({ data, error }) => {
        if (isMounted && data) {
          const infoMap = {};
          data.forEach(u => { infoMap[u.id] = u; });
          setUserInfos(infoMap);
        }
      });
    return () => { isMounted = false; };
  }, [user]);
  const [bookings, setBookings] = useState({});
  const [pendingBookings, setPendingBookings] = useState({});
  const [allPendingRequests, setAllPendingRequests] = useState({});
  const [shiftConfig, setShiftConfig] = useState({});
  const [modal, setModal] = useState({ open: false, dateKey: null, hour: null, duration: 4 });
  const [adminBookUserId, setAdminBookUserId] = useState('');
  const [cancelModal, setCancelModal] = useState({ open: false, dateKey: null, hour: null, duration: 4, isPending: false });
  const [editModal, setEditModal] = useState({ open: false, dateKey: null, hour: null, bookingId: null, startTime: '', endTime: '' });
  const userStatsRef = useRef();
  const [closedDays, setClosedDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth();
  const showDate = new Date(baseYear, baseMonth + monthOffset, 1);
  const year = showDate.getFullYear();
  const month = showDate.getMonth();

  // Fetch bookings and closed days for the month
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    Promise.all([
      fetchBookings(year, month),
      fetchClosedDays(year, month),
      fetchShiftTemplates(),
      fetchShiftOverrides(year, month),
      // Explicit own-pending fetch — guaranteed visible regardless of RLS policy
      supabase.from('bookings').select('*')
        .eq('user_id', user.id).eq('status', 'pending')
        .gte('date', fromDate).lte('date', toDate),
    ]).then(([bookingsData, closedDaysData, templates, overrides, { data: ownPendingData }]) => {
      if (!isMounted) return;
      // Confirmed bookings map
      const bookingsMap = {};
      // All-pending count map for admin calendar indicator
      const allPendingMap = {};
      bookingsData.forEach(b => {
        const dateKey = b.date;
        const hour = startTimeToDecimal(b.start_time);
        const entry = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time), start_time: b.start_time, end_time: b.end_time };
        if (b.status === 'booked') {
          if (!bookingsMap[dateKey]) bookingsMap[dateKey] = {};
          bookingsMap[dateKey][hour] = entry;
        } else if (b.status === 'pending') {
          if (!allPendingMap[dateKey]) allPendingMap[dateKey] = {};
          allPendingMap[dateKey][hour] = (allPendingMap[dateKey][hour] || 0) + 1;
        }
      });
      // Own pending requests (from explicit filtered fetch)
      const pendingMap = {};
      (ownPendingData || []).forEach(b => {
        const dateKey = b.date;
        const hour = startTimeToDecimal(b.start_time);
        if (!pendingMap[dateKey]) pendingMap[dateKey] = {};
        pendingMap[dateKey][hour] = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time), start_time: b.start_time, end_time: b.end_time };
      });
      setBookings(bookingsMap);
      setPendingBookings(pendingMap);
      setAllPendingRequests(allPendingMap);
      setClosedDays(closedDaysData.map(d => d.date));
      setShiftConfig(buildShiftConfigMap(year, month, templates, overrides));
      setLoading(false);
    }).catch(e => {
      setError('Failed to load data');
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [year, month]);

  const handleBook = (dateKey, hour, duration) => {
    if (isAdmin) {
      // Multi-select: toggle selection
      setSelectedShifts(prev => {
        const exists = prev.some(s => s.dateKey === dateKey && s.hour === hour);
        if (exists) {
          return prev.filter(s => !(s.dateKey === dateKey && s.hour === hour));
        } else {
          return [...prev, { dateKey, hour, duration }];
        }
      });
      setAdminBookUserId(user.id); // default to self
    } else {
      setModal({ open: true, dateKey, hour, duration });
    }
  };

  const handleCancelClick = (dateKey, hour, duration) => {
    if (isAdmin) {
      const booking = bookings[dateKey]?.[hour];
      setEditModal({
        open: true,
        dateKey,
        hour,
        bookingId: booking?.bookingId,
        startTime: (booking?.start_time || decimalHourToTimeStr(hour)).slice(0, 5),
        endTime: (booking?.end_time || computeEndTime(hour, duration)).slice(0, 5),
      });
    } else {
      const isPending = !bookings[dateKey]?.[hour] && !!pendingBookings[dateKey]?.[hour];
      setCancelModal({ open: true, dateKey, hour, duration, isPending });
    }
  };

  const refetchBookings = async () => {
    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const [bookingsData, { data: ownPendingData }] = await Promise.all([
      fetchBookings(year, month),
      supabase.from('bookings').select('*')
        .eq('user_id', user.id).eq('status', 'pending')
        .gte('date', fromDate).lte('date', toDate),
    ]);
    const bookingsMap = {};
    const allPendingMap = {};
    bookingsData.forEach(b => {
      const dKey = b.date;
      const h = startTimeToDecimal(b.start_time);
      const entry = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time), start_time: b.start_time, end_time: b.end_time };
      if (b.status === 'booked') {
        if (!bookingsMap[dKey]) bookingsMap[dKey] = {};
        bookingsMap[dKey][h] = entry;
      } else if (b.status === 'pending') {
        if (!allPendingMap[dKey]) allPendingMap[dKey] = {};
        allPendingMap[dKey][h] = (allPendingMap[dKey][h] || 0) + 1;
      }
    });
    const pendingMap = {};
    (ownPendingData || []).forEach(b => {
      const dKey = b.date;
      const h = startTimeToDecimal(b.start_time);
      if (!pendingMap[dKey]) pendingMap[dKey] = {};
      pendingMap[dKey][h] = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time), start_time: b.start_time, end_time: b.end_time };
    });
    setBookings(bookingsMap);
    setPendingBookings(pendingMap);
    setAllPendingRequests(allPendingMap);
  };

  const handleEditSave = async () => {
    setError('');
    try {
      await updateShift(editModal.bookingId, editModal.startTime, editModal.endTime);
      const [sh, sm] = editModal.startTime.split(':').map(Number);
      const [eh, em] = editModal.endTime.split(':').map(Number);
      const s = sh + sm / 60;
      const e = eh + em / 60;
      const newDuration = e > s ? e - s : 24 - s + e;
      setBookings(prev => {
        const day = { ...(prev[editModal.dateKey] || {}) };
        const existing = day[editModal.hour];
        if (existing) {
          day[editModal.hour] = { ...existing, start_time: editModal.startTime, end_time: editModal.endTime, duration: newDuration };
        }
        return { ...prev, [editModal.dateKey]: day };
      });
      setEditModal({ open: false, dateKey: null, hour: null, bookingId: null, startTime: '', endTime: '' });
    } catch (e) {
      setError('Edit failed');
    }
  };

  const handleEditCancelShift = async () => {
    setError('');
    try {
      await cancelShift(editModal.bookingId, isAdmin);
      await refetchBookings();
      setEditModal({ open: false, dateKey: null, hour: null, bookingId: null, startTime: '', endTime: '' });
    } catch (e) {
      setError('Cancel failed');
    }
  };

  const confirmBook = async () => {
    setError('');
    setModal({ open: false, dateKey: null, hour: null, duration: 4 });
    const { dateKey, hour, duration } = modal;
    try {
      const start_time = decimalHourToTimeStr(hour);
      const end_time = computeEndTime(hour, duration);
      if (isAdmin) {
        await bookShift({ user_id: adminBookUserId || user.id, date: dateKey, start_time, end_time });
      } else {
        await requestShift({ user_id: user.id, date: dateKey, start_time, end_time });
      }
      await refetchBookings();
      if (userStatsRef.current && userStatsRef.current.refresh) userStatsRef.current.refresh();
    } catch (e) {
      setError(isAdmin ? 'Booking failed' : 'Request failed');
    }
  };

  const handleCancel = async (dateKey, hour) => {
    setError('');
    try {
      const booking = bookings[dateKey]?.[hour] || pendingBookings[dateKey]?.[hour];
      if (!booking) return;
      await cancelShift(booking.bookingId, isAdmin);
      // Refetch bookings
      const bookingsData = await fetchBookings(year, month);
      const bookingsMap = {};
      bookingsData.forEach(b => {
        if (b.status !== 'booked') return;
        const dKey = b.date;
        const h = parseInt(b.start_time.split(':')[0], 10);
        if (!bookingsMap[dKey]) bookingsMap[dKey] = {};
        bookingsMap[dKey][h] = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time) };
      });
      setBookings(bookingsMap);
      if (userStatsRef.current && userStatsRef.current.refresh) userStatsRef.current.refresh();
    } catch (e) {
      setError('Cancel failed');
    }
  };

  const confirmCancel = async () => {
    if (!cancelModal.dateKey || cancelModal.hour == null) return;
    await handleCancel(cancelModal.dateKey, cancelModal.hour);
    setCancelModal({ open: false, dateKey: null, hour: null, duration: 4, isPending: false });
  };

  const renderDay = (day) => {
    // Ensure dateKey is in YYYY-MM-DD format with leading zeros
    const dateKey = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const now = new Date();
    const slotDate = new Date(`${dateKey}T00:00:00`);
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isPastDay = slotDate < todayDate;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 700;
    if (isMobile && isPastDay) {
      // Keep yesterday visible if an overnight shift is still active right now
      const yesterday = new Date(todayDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = slotDate.getTime() === yesterday.getTime();
      if (isYesterday) {
        const nowDecimal = now.getHours() + now.getMinutes() / 60;
        const hasActiveOvernightShift = Object.entries(bookings[dateKey] || {}).some(([h, b]) => {
          const startDecimal = parseFloat(h);
          const endDecimal = startDecimal + b.duration;
          return endDecimal > 24 && nowDecimal < (endDecimal - 24);
        });
        if (hasActiveOvernightShift) {
          // fall through and render the day
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
    if (closedDays.includes(dateKey)) {
      return (
        <div className={`day-block${darkMode ? ' dark-mode' : ''}`} style={{ opacity: 0.5 }}>
          <div className="date-label">{day}</div>
          <div style={{ color: '#a00', marginTop: 8 }}>Closed</div>
        </div>
      );
    }
    const configSlots = shiftConfig[dateKey] || [];
    const configuredHours = new Set(configSlots.map(s => parseFloat(s.start_hour)));
    // Any booking whose start_hour isn't in the current config is "orphaned" — still show it
    const orphanedSlots = Object.entries(bookings[dateKey] || {})
      .filter(([h]) => !configuredHours.has(parseFloat(h)))
      .map(([h, b]) => ({ start_hour: parseFloat(h), duration_hours: b.duration, orphaned: true }));
    const daySlots = [...configSlots, ...orphanedSlots].sort((a, b) => a.start_hour - b.start_hour);
    return (
      <div className={`day-block${darkMode ? ' dark-mode' : ''}`}>
        <div className="date-label">{day}</div>
        <div className="shifts">
          {daySlots.map(slot => {
            const { start_hour: hour, duration_hours: duration, orphaned } = slot;
            const booking = bookings[dateKey]?.[hour];
            const myPending = !isAdmin ? pendingBookings[dateKey]?.[hour] : null;
            const isMine = (booking && booking.userId === user.id) || !!myPending;
            let isPastSlot = isPastDay;
            if (!isPastDay && slotDate.getTime() === todayDate.getTime() && hour < now.getHours() + now.getMinutes() / 60) {
              isPastSlot = true;
            }
            let bookedBy = null;
            if (booking && isAdmin && userInfos[booking.userId]) {
              const u = userInfos[booking.userId];
              bookedBy = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
            }
            const canCancel = isMine || isAdmin;
            const isSelected = isAdmin && !booking && selectedShifts.some(s => s.dateKey === dateKey && s.hour === hour);
            // Determine button state class
            let slotClass = 'available';
            if (booking) slotClass = booking.userId === user.id ? 'mine' : 'booked';
            else if (myPending) slotClass = 'pending';
            const displayEntry = booking || myPending;
            return (
              <div key={hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  className={`shift-btn ${slotClass}${booking && booking.userId === user.id ? ' orange' : ''}${isPastSlot ? ' disabled' : ''}${isSelected ? ' selected' : ''}${darkMode ? ' dark-mode' : ''}`}
                  disabled={(booking && !isMine && !isAdmin) || (isPastSlot && !isAdmin) || orphaned}
                  onClick={() => {
                    if (booking) { if (canCancel) handleCancelClick(dateKey, hour, duration); }
                    else if (myPending) { handleCancelClick(dateKey, hour, duration); }
                    else if (!orphaned) { handleBook(dateKey, hour, duration); }
                  }}
                  style={isSelected ? { border: '2px solid #2ecc40', boxShadow: '0 0 6px #2ecc40' } : orphaned ? { opacity: 0.6, fontStyle: 'italic' } : {}}
                  title={orphaned ? 'Slot removed from schedule — existing booking still shown' : myPending ? 'Request pending admin approval' : undefined}
                >
                  {displayEntry?.start_time
                    ? `${displayEntry.start_time.slice(0, 5)}–${displayEntry.end_time.slice(0, 5)}`
                    : formatShiftTime(hour, duration).replace(' (next day)', '')}
                </button>
                {bookedBy && isAdmin && (
                  <span style={{ fontSize: '0.92em', color: '#888', marginTop: 2 }}>Booked by: {bookedBy}</span>
                )}
                {isAdmin && (allPendingRequests[dateKey]?.[hour] || 0) > 0 && (
                  <span style={{ fontSize: '0.78em', color: '#c47d00', marginTop: 2 }}>
                    {allPendingRequests[dateKey][hour]} request{allPendingRequests[dateKey][hour] !== 1 ? 's' : ''}
                  </span>
                )}
                {myPending && (
                  <span style={{ fontSize: '0.78em', color: '#0055aa', marginTop: 2 }}>Requested</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Admin block shift UI state
  const [blockUserId, setBlockUserId] = useState('');
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState('');

  // Admin block shift handler
  const handleBlockShift = async (e) => {
    e.preventDefault();
    setBlockError('');
    setBlockLoading(true);
    try {
      if (!blockUserId || !blockStartDate || !blockStartTime || !blockEndDate || !blockEndTime) {
        setBlockError('All fields required');
        setBlockLoading(false);
        return;
      }
      // Parse start and end datetimes
      const start = new Date(`${blockStartDate}T${blockStartTime}`);
      const end = new Date(`${blockEndDate}T${blockEndTime}`);
      if (end <= start) {
        setBlockError('End must be after start');
        setBlockLoading(false);
        return;
      }
      // For each date in the range, book configured slots that fall within the time window
      let currDate = new Date(start);
      currDate.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      while (currDate <= endDate) {
        const dateKey = currDate.toISOString().slice(0, 10);
        const daySlots = shiftConfig[dateKey] || [];
        for (const slot of daySlots) {
          const slotStart = new Date(`${dateKey}T${decimalHourToTimeStr(slot.start_hour).slice(0, 5)}`);
          if (slotStart >= start && slotStart < end) {
            await bookShift({
              user_id: blockUserId,
              date: dateKey,
              start_time: decimalHourToTimeStr(slot.start_hour),
              end_time: computeEndTime(slot.start_hour, slot.duration_hours),
            });
          }
        }
        currDate.setDate(currDate.getDate() + 1);
      }
      setBlockUserId('');
      setBlockStartDate('');
      setBlockStartTime('');
      setBlockEndDate('');
      setBlockEndTime('');
      // Refetch bookings
      const bookingsData = await fetchBookings(year, month);
      const bookingsMap = {};
      bookingsData.forEach(b => {
        if (b.status !== 'booked') return;
        const dKey = b.date;
        const h = parseInt(b.start_time.split(':')[0], 10);
        if (!bookingsMap[dKey]) bookingsMap[dKey] = {};
        bookingsMap[dKey][h] = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time) };
      });
      setBookings(bookingsMap);
    } catch (e) {
      setBlockError('Block failed');
    }
    setBlockLoading(false);
  };

  // Helper to format date as 'Tuesday 8th Feb 2026'
  function formatDateHuman(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    function ordinal(n) {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }
    return `${dayName} ${dayNum}${ordinal(dayNum)} ${monthName} ${year}`;
  }

  // Multi-select state for admins
  const [selectedShifts, setSelectedShifts] = useState([]); // [{dateKey, hour}]

  return (
    <div>
      {editModal.open && (
        <div className={`modal-backdrop${darkMode ? ' dark-mode' : ''}`}>
          <div className={`modal${darkMode ? ' dark-mode' : ''}`}>
            <h3 style={{ marginTop: 0 }}>Edit Shift</h3>
            <div style={{ marginBottom: 12 }}>{formatDateHuman(editModal.dateKey)}</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                Start
                <input
                  type="time"
                  value={editModal.startTime}
                  onChange={e => setEditModal(m => ({ ...m, startTime: e.target.value }))}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                End
                <input
                  type="time"
                  value={editModal.endTime}
                  onChange={e => setEditModal(m => ({ ...m, endTime: e.target.value }))}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditModal({ open: false, dateKey: null, hour: null, bookingId: null, startTime: '', endTime: '' })}>Close</button>
              <button onClick={handleEditCancelShift} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}>Cancel Shift</button>
              <button onClick={handleEditSave} style={{ background: '#2196f3', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Admin booking for another user */}
      <ConfirmModal
        open={modal.open}
        onClose={() => setModal({ open: false, dateKey: null, hour: null })}
        onConfirm={confirmBook}
        message={modal.dateKey && modal.hour != null ? (
          <div>
            {`${isAdmin ? 'Book' : 'Request'} shift on ${formatDateHuman(modal.dateKey)}: ${formatShiftTime(modal.hour, modal.duration)}?`}
            {isAdmin && (
              <div style={{ marginTop: 12 }}>
                <label htmlFor="admin-book-user" style={{ marginRight: 8 }}>For user:</label>
                <select
                  id="admin-book-user"
                  value={adminBookUserId}
                  onChange={e => setAdminBookUserId(e.target.value)}
                  style={{ minWidth: 180 }}
                >
                  {Object.entries(userInfos).map(([id, u]) => (
                    <option key={id} value={id}>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : ''}
        darkMode={darkMode}
      />
      <ConfirmModal
        open={cancelModal.open}
        onClose={() => setCancelModal({ open: false, dateKey: null, hour: null, duration: 4, isPending: false })}
        onConfirm={confirmCancel}
        message={cancelModal.dateKey && cancelModal.hour != null ? `${cancelModal.isPending ? 'Withdraw request' : 'Cancel shift'} on ${formatDateHuman(cancelModal.dateKey)}: ${formatShiftTime(cancelModal.hour, cancelModal.duration)}?` : ''}
        darkMode={darkMode}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m - 1)}
          disabled={isAdmin ? monthOffset === -24 : monthOffset === 0}
        >
          &lt; Prev
        </button>
        <h2>{MONTHS[month]} {year}</h2>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m + 1)}
          disabled={isAdmin ? monthOffset === 24 : monthOffset === 1}
        >
          Next &gt;
        </button>
      </div>
      {/* AdminClosedDays and AdminUserStats removed from main page. Use Closed Days tab for admin controls. */}
      {error && <div style={{ color: '#a00', marginBottom: 8 }}>{error}</div>}
      {loading ? <div>Loading...</div> : <Calendar year={year} month={month} renderDay={renderDay} darkMode={darkMode} />}
      {isAdmin && selectedShifts.length > 0 && (
        <div style={{ margin: '16px 0', padding: '12px', border: '1px solid #2ecc40', borderRadius: 8, background: darkMode ? '#222' : '#f8fff8' }}>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="admin-book-user-multi" style={{ marginRight: 8 }}>Book selected shifts for:</label>
            <select
              id="admin-book-user-multi"
              value={adminBookUserId}
              onChange={e => setAdminBookUserId(e.target.value)}
              style={{ minWidth: 180 }}
            >
              {Object.entries(userInfos).map(([id, u]) => (
                <option key={id} value={id}>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</option>
              ))}
            </select>
          </div>
          <button
            style={{ background: '#2ecc40', color: '#fff', padding: '8px 18px', borderRadius: 6, fontWeight: 600, fontSize: '1.1em', border: 'none', cursor: 'pointer' }}
            onClick={async () => {
              setError('');
              try {
                for (const s of selectedShifts) {
                  const start_time = decimalHourToTimeStr(s.hour);
                  const end_time = computeEndTime(s.hour, s.duration);
                  await bookShift({
                    user_id: adminBookUserId,
                    date: s.dateKey,
                    start_time,
                    end_time
                  });
                }
                setSelectedShifts([]);
                // Refetch bookings
                const bookingsData = await fetchBookings(year, month);
                const bookingsMap = {};
                bookingsData.forEach(b => {
                  if (b.status !== 'booked') return;
                  const dKey = b.date;
                  const h = parseInt(b.start_time.split(':')[0], 10);
                  if (!bookingsMap[dKey]) bookingsMap[dKey] = {};
                  bookingsMap[dKey][h] = { bookingId: b.id, userId: b.user_id, duration: bookingDuration(b.start_time, b.end_time) };
                });
                setBookings(bookingsMap);
                if (userStatsRef.current && userStatsRef.current.refresh) userStatsRef.current.refresh();
              } catch (e) {
                setError('Multi-booking failed');
              }
            }}
          >Book Selected Shifts</button>
          <button
            style={{ marginLeft: 12, background: '#eee', color: '#333', padding: '8px 18px', borderRadius: 6, fontWeight: 500, fontSize: '1em', border: 'none', cursor: 'pointer' }}
            onClick={() => setSelectedShifts([])}
          >Cancel</button>
        </div>
      )}
    </div>
  );
};

export default BookPage;
