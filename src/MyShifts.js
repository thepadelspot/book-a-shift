import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { cancelShift } from './api';
import ConfirmModal from './ConfirmModal';

function ordinal(n) {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNum = date.getDate();
  return `${days[date.getDay()]} ${dayNum}${ordinal(dayNum)} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTimeHuman(timeStr) {
  if (!timeStr) return '';
  const [h] = timeStr.split(':');
  let hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'am' : 'pm';
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}${suffix}`;
}

// Returns the ISO date string (YYYY-MM-DD) for the Monday of the week containing dateStr
function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function formatWeekHeader(mondayStr) {
  const d = new Date(mondayStr + 'T00:00:00');
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNum = d.getDate();
  return `Week of ${dayNum}${ordinal(dayNum)} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatDayShort(dateStr) {
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getDate();
  return `${DAYS_SHORT[d.getDay()]} ${dayNum}${ordinal(dayNum)}`;
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
  const [darkMode, setDarkMode] = useState(() => document.body.classList.contains('dark-mode'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDarkMode(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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
  const [hideCancelled, setHideCancelled] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [collapsedWeeks, setCollapsedWeeks] = useState(new Set());

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

  // Reset collapsed state when month changes
  useEffect(() => {
    setCollapsedWeeks(new Set());
  }, [viewYear, viewMonth]);

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

  const toggleWeek = (weekKey) => {
    setCollapsedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey); else next.add(weekKey);
      return next;
    });
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading your shifts...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '2rem' }}>{error}</div>;

  const getStats = () => {
    let shiftsWorked = 0, shiftsBooked = 0, cancellations = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    shifts.forEach(b => {
      if (b.status === 'booked') {
        if (b.date < todayStr) shiftsWorked++; else shiftsBooked++;
      } else if (b.status === 'canceled' && !b.canceled_by_admin) {
        cancellations++;
      }
    });
    return { shiftsWorked, shiftsBooked, cancellations };
  };

  const hasShiftEnded = (shift) => {
    const now = new Date();
    const shiftDateTime = new Date(`${shift.date}T${shift.end_time}`);
    return now > shiftDateTime;
  };

  const stats = getStats();

  // Build week groups from the visible (filtered) shift list
  const visibleShifts = shifts.filter(s => {
    if (hideCancelled && s.status === 'canceled') return false;
    if (hideCompleted && s.status === 'booked' && hasShiftEnded(s)) return false;
    return true;
  });
  const weekGroupMap = {};
  visibleShifts.forEach(shift => {
    const wk = getWeekStart(shift.date);
    if (!weekGroupMap[wk]) weekGroupMap[wk] = [];
    weekGroupMap[wk].push(shift);
  });
  const weekGroups = Object.entries(weekGroupMap).sort(([a], [b]) => a.localeCompare(b));

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
      <div style={{ fontSize: '1rem', color: '#007bff', marginBottom: '1rem' }}>
        <strong>Shifts Worked:</strong> {stats.shiftsWorked} &nbsp;
        <strong>Shifts Booked:</strong> {stats.shiftsBooked} &nbsp;
        <strong>Cancelled:</strong> {stats.cancellations}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <label style={{ cursor: 'pointer', userSelect: 'none', fontSize: '0.95rem', color: darkMode ? '#b0b0b0' : '#555' }}>
          <input
            type="checkbox"
            checked={hideCancelled}
            onChange={e => setHideCancelled(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Hide cancelled
        </label>
        <label style={{ cursor: 'pointer', userSelect: 'none', fontSize: '0.95rem', color: darkMode ? '#b0b0b0' : '#555' }}>
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={e => setHideCompleted(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Hide completed
        </label>
      </div>

      {/* Shifts grouped by week */}
      {weekGroups.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#888' }}>No shifts for this month</div>
      ) : (
        <div style={{ width: '100%', maxWidth: 480 }}>
          {weekGroups.map(([weekKey, weekShifts]) => {
            const isCollapsed = collapsedWeeks.has(weekKey);
            const borderColor = darkMode ? '#333' : '#dde';
            const headerBg = darkMode ? '#2a2e38' : '#f0f4ff';
            const headerColor = darkMode ? '#a0b0ff' : '#3355cc';
            return (
              <div key={weekKey} style={{ marginBottom: 10 }}>
                {/* Week header */}
                <button
                  onClick={() => toggleWeek(weekKey)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.8rem',
                    background: headerBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: isCollapsed ? 8 : '8px 8px 0 0',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: headerColor,
                    textAlign: 'left',
                  }}
                >
                  <span>{isCollapsed ? '▶' : '▼'} {formatWeekHeader(weekKey)}</span>
                  <span style={{ fontWeight: 400, fontSize: '0.82rem', color: darkMode ? '#888' : '#aaa' }}>
                    {weekShifts.length} shift{weekShifts.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Week rows */}
                {!isCollapsed && (
                  <div style={{ border: `1px solid ${borderColor}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                    {weekShifts.map((shift, i) => {
                      const shiftEnded = hasShiftEnded(shift);
                      const isLast = i === weekShifts.length - 1;
                      const rowBg = shift.status === 'canceled'
                        ? (darkMode ? '#3d1f1f' : '#fff5f5')
                        : (darkMode ? '#1e2128' : '#fff');
                      return (
                        <div
                          key={shift.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.55rem 0.8rem',
                            background: rowBg,
                            borderBottom: isLast ? 'none' : `1px solid ${darkMode ? '#2c2c2c' : '#eee'}`,
                            opacity: shift.status === 'canceled' || shiftEnded ? 0.75 : 1,
                            gap: '0.5rem',
                          }}
                        >
                          <span style={{ fontWeight: 500, fontSize: '0.92rem', minWidth: 68 }}>
                            {formatDayShort(shift.date)}
                          </span>
                          <span style={{ color: '#888', fontSize: '0.88rem', flex: 1 }}>
                            {formatTimeHuman(shift.start_time)} – {formatTimeHuman(shift.end_time)}
                          </span>
                          <span style={{ minWidth: 76, textAlign: 'right' }}>
                            {shift.status === 'canceled' && (
                              <span style={{ color: '#c0392b', fontSize: '0.82rem', fontWeight: 500 }}>Cancelled</span>
                            )}
                            {shift.status === 'booked' && shiftEnded && (
                              <span style={{ color: darkMode ? '#5cb85c' : '#27ae60', fontSize: '0.82rem', fontWeight: 500 }}>Completed</span>
                            )}
                            {shift.status === 'booked' && !shiftEnded && (
                              <button
                                style={{
                                  padding: '0.28rem 0.65rem',
                                  borderRadius: 5,
                                  border: 'none',
                                  background: '#e74c3c',
                                  color: '#fff',
                                  fontWeight: 500,
                                  fontSize: '0.82rem',
                                  cursor: 'pointer',
                                }}
                                onClick={() => handleCancel(shift.id, formatDateHuman(shift.date))}
                              >
                                Cancel
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
