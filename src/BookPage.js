import React, { useState, useEffect } from 'react';
import Calendar from './Calendar';
import { fetchBookings, fetchClosedDays, bookShift, cancelShift, supabase } from './api';
import AdminClosedDays from './AdminClosedDays';
import UserStats from './UserStats';

const HOURS = [8, 12, 16, 20]; // 8am, 12pm, 4pm, 8pm

// For demo, store bookings in state
const initialBookings = {};



const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const BookPage = ({ user, darkMode }) => {
  const [isAdmin, setIsAdmin] = useState(false);
    // Check if user is admin
    useEffect(() => {
      let isMounted = true;
      if (!user?.id) return;
      supabase
        .from('roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (isMounted) setIsAdmin(data?.role === 'admin');
        });
      return () => { isMounted = false; };
    }, [user]);
  const [bookings, setBookings] = useState({});
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

  const handleBook = async (dateKey, hour) => {
    setError('');
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
    } catch (e) {
      setError('Cancel failed');
    }
  };

  const renderDay = (day) => {
    const dateKey = `${year}-${month+1}-${day}`;
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
            return (
              <button
                key={hour}
                className={`shift-btn ${booking ? (isMine ? 'mine' : 'booked') : 'available'}${darkMode ? ' dark-mode' : ''}`}
                disabled={booking && !isMine}
                onClick={() => booking ? handleCancel(dateKey, hour) : handleBook(dateKey, hour)}
              >
                {`${hour}:00 - ${hour+4}:00`}
                {booking ? (isMine ? ' (Cancel)' : ' (Booked)') : ' (Book)'}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <UserStats userId={user.id} />
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
      {isAdmin && <AdminClosedDays year={year} month={month} darkMode={darkMode} />}
      {error && <div style={{ color: '#a00', marginBottom: 8 }}>{error}</div>}
      {loading ? <div>Loading...</div> : <Calendar year={year} month={month} renderDay={renderDay} darkMode={darkMode} />}
    </div>
  );
};

export default BookPage;
