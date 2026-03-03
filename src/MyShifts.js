import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { cancelShift } from './api';
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getMonthRange(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export default function MyShifts({ user }) {
  // Track dark mode from body class
  const [darkMode, setDarkMode] = useState(() => document.body.classList.contains('dark-mode'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDarkMode(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Month navigation
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth();
  const showDate = new Date(baseYear, baseMonth + monthOffset, 1);
  const viewYear = showDate.getFullYear();
  const viewMonth = showDate.getMonth();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, bookingId: null, label: '' });

  // Fetch shifts for the selected month
  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = getMonthRange(viewYear, viewMonth);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setShifts(data || []);
    } catch (e) {
      setError('Failed to load shifts');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line
  }, [user.id, viewYear, viewMonth]);

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

  // Helper to compute stats for the month
  const getStats = () => {
    let shiftsWorked = 0, shiftsBooked = 0, cancellations = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    shifts.forEach(b => {
      if (b.status === 'booked') {
        if (b.date < todayStr) {
          shiftsWorked++;
        } else {
          shiftsBooked++;
        }
      } else if (b.status === 'canceled') {
        cancellations++;
      }
    });
    return { shiftsWorked, shiftsBooked, cancellations };
  };

  // Check if a shift has ended (past the end time)
  const hasShiftEnded = (shift) => {
    const now = new Date();
    const shiftDateTime = new Date(`${shift.date}T${shift.end_time}`);
    return now > shiftDateTime;
  };

  const stats = getStats();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem', width: '100%', padding: '0 1rem', boxSizing: 'border-box', background: darkMode ? '#181818' : '#fff', color: darkMode ? '#e0e0e0' : '#181818', minHeight: '100vh' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>My Shifts</h3>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m - 1)}
          disabled={monthOffset === -24}
        >
          &lt; Prev
        </button>
        <h3 style={{ margin: 0, minWidth: '180px', textAlign: 'center' }}>{MONTHS[viewMonth]} {viewYear}</h3>
        <button
          className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={() => setMonthOffset(m => m + 1)}
          disabled={monthOffset === 24}
        >
          Next &gt;
        </button>
      </div>

      {/* Stats summary */}
      <div style={{ fontSize: '1rem', color: '#007bff', marginBottom: '1.5rem' }}>
        <strong>Shifts Worked:</strong> {stats.shiftsWorked} &nbsp;
        <strong>Shifts Booked:</strong> {stats.shiftsBooked} &nbsp;
        <strong>Cancelled:</strong> {stats.cancellations}
      </div>

      {/* Shifts list */}
      {shifts.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#888' }}>No shifts for this month</div>
      ) : (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {shifts.map(shift => {
              const shiftEnded = hasShiftEnded(shift);
              return (
                <li
                  key={shift.id}
                  style={{
                    marginBottom: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '0.9rem 1rem',
                    background: shift.status === 'canceled' ? (darkMode ? '#4d2323' : '#ffeaea') : (darkMode ? '#23272f' : '#fff'),
                    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    opacity: shift.status === 'canceled' || shiftEnded ? 0.7 : 1,
                    color: darkMode ? '#e0e0e0' : '#181818',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '1.08rem', marginBottom: 2 }}>{formatDateHuman(shift.date)}</div>
                  <div style={{ color: '#888', marginBottom: 6 }}>{formatTimeHuman(shift.start_time)} to {formatTimeHuman(shift.end_time)}</div>
                  {shift.status === 'booked' && !shiftEnded && (
                    <button
                      style={{
                        marginTop: 4,
                        padding: '0.45rem 1.1rem',
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
                  )}
                  {shift.status === 'booked' && shiftEnded && (
                    <span style={{ color: '#888', fontWeight: 500, fontSize: '0.98rem' }}>Completed</span>
                  )}
                  {shift.status === 'canceled' && (
                    <span style={{ color: '#a00', fontWeight: 500, fontSize: '0.98rem' }}>Canceled</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ConfirmModal
        open={modal.open}
        onClose={() => setModal({ open: false, bookingId: null, label: '' })}
        onConfirm={confirmCancel}
        message={`Cancel shift: ${modal.label}?`}
        darkMode={darkMode}
      />
    </div>
  );
}
