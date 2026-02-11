import React, { useState, useEffect, useRef } from 'react';
import Calendar from './Calendar';
import { fetchBookings, fetchClosedDays, bookShift, cancelShift } from './api';
import { supabase } from './supabaseClient';
import AdminClosedDays from './AdminClosedDays';
import AdminUserStats from './AdminUserStats';
import ConfirmModal from './ConfirmModal';

const HOURS = [8, 12, 16, 20]; // 8am, 12pm, 4pm, 8pm

// For demo, store bookings in state
const initialBookings = {};



const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const BookPage = ({ user, darkMode }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmails, setUserEmails] = useState({});
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
    // Fetch all user emails for admin
    supabase
      .from('users')
      .select('id, email')
      .then(({ data, error }) => {
        if (isMounted && data) {
          const emailMap = {};
          data.forEach(u => { emailMap[u.id] = u.email; });
          setUserEmails(emailMap);
        }
      });
    return () => { isMounted = false; };
  }, [user]);
  const [bookings, setBookings] = useState({});
  const [modal, setModal] = useState({ open: false, dateKey: null, hour: null });
  const [cancelModal, setCancelModal] = useState({ open: false, dateKey: null, hour: null });
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
    Promise.all([
      fetchBookings(year, month),
      fetchClosedDays(year, month)
    ]).then(([bookingsData, closedDaysData]) => {
      if (!isMounted) return;
      // Transform bookings to { [dateKey]: { [hour]: { bookingId, userId, status } } }
      const bookingsMap = {};
      bookingsData.forEach(b => {
        if (b.status !== 'booked') return;
        const dateKey = b.date;
        const hour = parseInt(b.start_time.split(':')[0], 10);
        if (!bookingsMap[dateKey]) bookingsMap[dateKey] = {};
        bookingsMap[dateKey][hour] = { bookingId: b.id, userId: b.user_id };
      });
      setBookings(bookingsMap);
      setClosedDays(closedDaysData.map(d => d.date));
      setLoading(false);
    }).catch(e => {
      setError('Failed to load data');
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [year, month]);

  const handleBook = (dateKey, hour) => {
    setModal({ open: true, dateKey, hour });
  };

  const handleCancelClick = (dateKey, hour) => {
    setCancelModal({ open: true, dateKey, hour });
  };

  const confirmBook = async () => {
    setError('');
    setModal({ open: false, dateKey: null, hour: null });
    const { dateKey, hour } = modal;
    try {
      const start_time = `${String(hour).padStart(2, '0')}:00:00`;
      const end_time = `${String(hour+4).padStart(2, '0')}:00:00`;
      await bookShift({
        user_id: user.id,
        date: dateKey,
        start_time,
        end_time
      });
      // Refetch bookings
      const bookingsData = await fetchBookings(year, month);
      const bookingsMap = {};
      bookingsData.forEach(b => {
        if (b.status !== 'booked') return;
        const dKey = b.date;
        const h = parseInt(b.start_time.split(':')[0], 10);
        if (!bookingsMap[dKey]) bookingsMap[dKey] = {};
        bookingsMap[dKey][h] = { bookingId: b.id, userId: b.user_id };
      });
      setBookings(bookingsMap);
      if (userStatsRef.current && userStatsRef.current.refresh) userStatsRef.current.refresh();
    } catch (e) {
      setError('Booking failed');
    }
  };

  const handleCancel = async (dateKey, hour) => {
    setError('');
    try {
      const booking = bookings[dateKey]?.[hour];
      if (!booking) return;
      await cancelShift(booking.bookingId);
      // Refetch bookings
      const bookingsData = await fetchBookings(year, month);
      const bookingsMap = {};
      bookingsData.forEach(b => {
        if (b.status !== 'booked') return;
        const dKey = b.date;
        const h = parseInt(b.start_time.split(':')[0], 10);
        if (!bookingsMap[dKey]) bookingsMap[dKey] = {};
        bookingsMap[dKey][h] = { bookingId: b.id, userId: b.user_id };
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
    setCancelModal({ open: false, dateKey: null, hour: null });
  };

  const renderDay = (day) => {
    // Ensure dateKey is in YYYY-MM-DD format with leading zeros
    const dateKey = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const now = new Date();
    const slotDate = new Date(`${dateKey}T00:00:00`);
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isPastDay = slotDate < todayDate;
    if (closedDays.includes(dateKey)) {
      return (
        <div className={`day-block${darkMode ? ' dark-mode' : ''}`} style={{ opacity: 0.5 }}>
          <div className="date-label">{day}</div>
          <div style={{ color: '#a00', marginTop: 8 }}>Closed</div>
        </div>
      );
    }
    return (
      <div className={`day-block${darkMode ? ' dark-mode' : ''}`}>
        <div className="date-label">{day}</div>
        <div className="shifts">
          {HOURS.map(hour => {
            const booking = bookings[dateKey]?.[hour];
            const isMine = booking && booking.userId === user.id;
            // Disable if booked by someone else or if in the past
            let isPastSlot = isPastDay;
            // If current day, disable slots with hour < now.getHours()
            if (!isPastDay && slotDate.getTime() === todayDate.getTime() && hour < now.getHours()) {
              isPastSlot = true;
            }
            let bookedBy = null;
            if (booking && isAdmin && userEmails[booking.userId]) {
              bookedBy = userEmails[booking.userId];
            }
            return (
              <div key={hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  className={`shift-btn ${booking ? (isMine ? 'mine' : 'booked') : 'available'}${isMine ? ' orange' : ''}${isPastSlot ? ' disabled' : ''}${darkMode ? ' dark-mode' : ''}`}
                  disabled={booking && !isMine || isPastSlot}
                  onClick={() => booking ? handleCancelClick(dateKey, hour) : handleBook(dateKey, hour)}
                >
                  {`${hour}:00 - ${hour+4}:00`}
                </button>
                {bookedBy && (
                  <span style={{ fontSize: '0.92em', color: '#888', marginTop: 2 }}>Booked by: {bookedBy}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <ConfirmModal
        open={modal.open}
        onClose={() => setModal({ open: false, dateKey: null, hour: null })}
        onConfirm={confirmBook}
        message={modal.dateKey && modal.hour ? `Book shift on ${modal.dateKey} from ${modal.hour}:00 to ${modal.hour+4}:00?` : ''}
        darkMode={darkMode}
      />
      <ConfirmModal
        open={cancelModal.open}
        onClose={() => setCancelModal({ open: false, dateKey: null, hour: null })}
        onConfirm={confirmCancel}
        message={cancelModal.dateKey && cancelModal.hour != null ? `Cancel shift on ${cancelModal.dateKey} from ${cancelModal.hour}:00 to ${cancelModal.hour+4}:00?` : ''}
        darkMode={darkMode}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m - 1)}
          disabled={monthOffset === 0}
        >
          &lt; Prev
        </button>
        <h2>{MONTHS[month]} {year}</h2>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m + 1)}
          disabled={monthOffset === 6}
        >
          Next &gt;
        </button>
      </div>
      {/* AdminClosedDays and AdminUserStats removed from main page. Use Closed Days tab for admin controls. */}
      {error && <div style={{ color: '#a00', marginBottom: 8 }}>{error}</div>}
      {loading ? <div>Loading...</div> : <Calendar year={year} month={month} renderDay={renderDay} darkMode={darkMode} />}
    </div>
  );
};

export default BookPage;
