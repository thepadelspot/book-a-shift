import React, { useState } from 'react';
import Calendar from './Calendar';

const HOURS = [8, 12, 16, 20]; // 8am, 12pm, 4pm, 8pm

// For demo, store bookings in state
const initialBookings = {};



const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const BookPage = ({ user, darkMode }) => {
  const [bookings, setBookings] = useState(initialBookings);
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth();
  const showDate = new Date(baseYear, baseMonth + monthOffset, 1);
  const year = showDate.getFullYear();
  const month = showDate.getMonth();

  const handleBook = (dateKey, hour) => {
    setBookings(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [hour]: user.email,
      },
    }));
  };

  const handleCancel = (dateKey, hour) => {
    setBookings(prev => {
      const updated = { ...prev };
      if (updated[dateKey]) {
        delete updated[dateKey][hour];
        if (Object.keys(updated[dateKey]).length === 0) delete updated[dateKey];
      }
      return updated;
    });
  };

  const renderDay = (day) => {
    const dateKey = `${year}-${month+1}-${day}`;
    return (
      <div className={`day-block${darkMode ? ' dark-mode' : ''}`}>
        <div className="date-label">{day}</div>
        <div className="shifts">
          {HOURS.map(hour => {
            const bookedBy = bookings[dateKey]?.[hour];
            const isMine = bookedBy === user.email;
            return (
              <button
                key={hour}
                className={`shift-btn ${bookedBy ? (isMine ? 'mine' : 'booked') : 'available'}${darkMode ? ' dark-mode' : ''}`}
                disabled={bookedBy && !isMine}
                onClick={() => bookedBy ? handleCancel(dateKey, hour) : handleBook(dateKey, hour)}
              >
                {`${hour}:00 - ${hour+4}:00`}
                {bookedBy ? (isMine ? ' (Cancel)' : ' (Booked)') : ' (Book)'}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
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
      <Calendar year={year} month={month} renderDay={renderDay} darkMode={darkMode} />
    </div>
  );
};

export default BookPage;
