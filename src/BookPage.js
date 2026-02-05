import React, { useState } from 'react';
import Calendar from './Calendar';

const HOURS = [8, 12, 16, 20]; // 8am, 12pm, 4pm, 8pm

// For demo, store bookings in state
const initialBookings = {};

const BookPage = ({ user }) => {
  const [bookings, setBookings] = useState(initialBookings);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

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
      <div className="day-block">
        <div className="date-label">{day}</div>
        <div className="shifts">
          {HOURS.map(hour => {
            const bookedBy = bookings[dateKey]?.[hour];
            const isMine = bookedBy === user.email;
            return (
              <button
                key={hour}
                className={`shift-btn ${bookedBy ? (isMine ? 'mine' : 'booked') : 'available'}`}
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
      <h2>Book a Shift</h2>
      <Calendar year={year} month={month} renderDay={renderDay} />
    </div>
  );
};

export default BookPage;
