import React, { useEffect, useState } from 'react';
import { fetchUserShifts, cancelShift } from './api';
import ConfirmModal from './ConfirmModal';

// Utility function to format date in a human-readable way
function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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

// Utility function to format time in a human-readable way
function formatTimeHuman(timeStr) {
  if (!timeStr) return '';
  const [h] = timeStr.split(':');
  let hour = parseInt(h, 10);
  let suffix = hour < 12 ? 'am' : 'pm';
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}${suffix}`;
}

export default function MyShifts({ user }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, bookingId: null, label: '' });

  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUserShifts(user.id);
      setShifts(data);
    } catch (e) {
      setError('Failed to load shifts');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line
  }, [user.id]);

  const handleCancel = (bookingId, label) => {
    setModal({ open: true, bookingId, label });
  };

  const confirmCancel = async () => {
    setError('');
    setModal({ open: false, bookingId: null, label: '' });
    try {
      await cancelShift(modal.bookingId);
      await loadShifts();
    } catch (e) {
      setError('Cancel failed');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading your shifts...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '2rem' }}>{error}</div>;
  if (!shifts.length) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>You have no upcoming shifts.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>My Shifts</h3>
      <ul style={{ listStyle: 'none', padding: 0, maxWidth: 420, width: '100%' }}>
        {shifts.map(shift => (
          <li
            key={shift.id}
            style={{
              marginBottom: 16,
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: '1.1rem 1.2rem',
              background: window.document.body.classList.contains('dark-mode') ? '#23272f' : '#fff',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              transition: 'background 0.2s',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 4 }}>{formatDateHuman(shift.date)}</div>
            <div style={{ color: '#888', marginBottom: 8 }}>{formatTimeHuman(shift.start_time)} to {formatTimeHuman(shift.end_time)}</div>
            <button
              style={{
                marginTop: 6,
                padding: '0.5rem 1.2rem',
                borderRadius: 6,
                border: 'none',
                background: '#e74c3c',
                color: '#fff',
                fontWeight: 500,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
                transition: 'background 0.2s',
              }}
              onClick={() => handleCancel(shift.id, `${shift.date} ${shift.start_time}-${shift.end_time}`)}
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
      <ConfirmModal
        open={modal.open}
        onClose={() => setModal({ open: false, bookingId: null, label: '' })}
        onConfirm={confirmCancel}
        message={`Cancel shift: ${modal.label}?`}
        darkMode={window.document.body.classList.contains('dark-mode')}
      />
    </div>
  );
}
