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

export default function MyShifts({ user }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, bookingId: null, label: '' });
  const [grouped, setGrouped] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [modal, setModal] = useState({ open: false, bookingId: null, label: '' });

  // Fetch all shifts (booked and canceled) for the user
  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setShifts(data);
      // Group by year-month
      const groupedObj = {};
      data.forEach(shift => {
        const d = new Date(shift.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!groupedObj[ym]) groupedObj[ym] = [];
        groupedObj[ym].push(shift);
      });
      setGrouped(groupedObj);
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
  if (!shifts.length) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>You have no shifts.</div>;

  // Helper to get month name
  const getMonthName = (ym) => {
    const [year, month] = ym.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[parseInt(month,10)-1]} ${year}`;
  };

  // Helper to compute stats for a month
  const getStats = (arr) => {
    let hours = 0, cancellations = 0;
    arr.forEach(b => {
      if (b.status === 'booked') {
        const start = parseInt(b.start_time.split(':')[0], 10);
        const end = parseInt(b.end_time.split(':')[0], 10);
        hours += end - start;
      } else if (b.status === 'canceled') {
        cancellations++;
      }
    });
    return { hours, cancellations };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem', width: '100%' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>My Shifts</h3>
      {Object.keys(grouped).sort((a,b)=>b.localeCompare(a)).map(ym => {
        const arr = grouped[ym];
        const stats = getStats(arr);
        return (
          <div key={ym} style={{ width: '100%', maxWidth: 480, marginBottom: 32, background: window.document.body.classList.contains('dark-mode') ? '#23272f' : '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '1.15rem' }}>{getMonthName(ym)}</span>
              <span style={{ fontSize: '1rem', color: '#007bff' }}><strong>Hours:</strong> {stats.hours} &nbsp; <strong>Cancelled:</strong> {stats.cancellations}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {arr.map(shift => (
                <li
                  key={shift.id}
                  style={{
                    marginBottom: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '0.9rem 1rem',
                    background: shift.status === 'canceled' ? '#ffeaea' : (window.document.body.classList.contains('dark-mode') ? '#23272f' : '#fff'),
                    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    opacity: shift.status === 'canceled' ? 0.7 : 1,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '1.08rem', marginBottom: 2 }}>{formatDateHuman(shift.date)}</div>
                  <div style={{ color: '#888', marginBottom: 6 }}>{formatTimeHuman(shift.start_time)} to {formatTimeHuman(shift.end_time)}</div>
                  {shift.status === 'booked' && (
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
                  {shift.status === 'canceled' && (
                    <span style={{ color: '#a00', fontWeight: 500, fontSize: '0.98rem' }}>Canceled</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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
