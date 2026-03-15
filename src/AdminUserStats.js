import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { generateMonthlyPayePDF } from './utils/pdfExport';
import { fetchShiftTemplates, fetchShiftOverridesByDateRange } from './api';
import { buildShiftConfigMap, computeEndTime, decimalHourToTimeStr } from './utils/shiftConfig';

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

export default function AdminUserStats({ year, month, darkMode, isAdmin }) {
  // State for stats and users
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // State for month navigation
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth();
  const showDate = new Date(baseYear, baseMonth + monthOffset, 1);
  const viewYear = showDate.getFullYear();
  const viewMonth = showDate.getMonth();

  // Admin block shift UI state
  const [blockUserId, setBlockUserId] = useState('');
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState('');

  // PDF export state
  const [exporting, setExporting] = useState(false);

  // Fetch users and bookings for stats
  useEffect(() => {
    let isMounted = true;
    async function fetchAll() {
      setLoading(true);
      setError('');
      try {
        // Fetch users
        const { data: usersData, error: usersError } = await supabase.from('users').select('id, email, firstName, lastName');
        if (usersError) throw new Error('Failed to fetch users');
        // Get all bookings for the selected month
        const { from, to } = getMonthRange(viewYear, viewMonth);
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('user_id, status, start_time, end_time, date')
          .gte('date', from)
          .lte('date', to);
        if (bookingsError) throw new Error('Failed to fetch bookings');
        // Calculate stats per user
        const statsMap = {};
        usersData.forEach(u => {
          statsMap[u.id] = { email: u.email, hoursWorked: 0, hoursBooked: 0, cancellations: 0 };
        });
        const todayStr = new Date().toISOString().slice(0, 10);
        bookings.forEach(b => {
          if (!statsMap[b.user_id]) return;
          const [sh, sm] = b.start_time.split(':').map(Number);
          const [eh, em] = b.end_time.split(':').map(Number);
          const s = sh + sm / 60;
          const e = eh + em / 60;
          const hours = e > s ? e - s : 24 - s + e;
          if (b.status === 'booked') {
            if (b.date < todayStr) {
              statsMap[b.user_id].hoursWorked += hours;
            } else {
              statsMap[b.user_id].hoursBooked += hours;
            }
          } else if (b.status === 'canceled') {
            statsMap[b.user_id].cancellations++;
          }
        });
        if (isMounted) {
          setUsers(usersData);
          setStats(statsMap);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load stats');
          setLoading(false);
        }
      }
    }
    fetchAll();
    return () => { isMounted = false; };
  }, [viewYear, viewMonth]);

  // PDF export handler
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Get detailed bookings for the current month
      const { from, to } = getMonthRange(viewYear, viewMonth);
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (bookingsError) throw bookingsError;

      // Generate PDF
      generateMonthlyPayePDF(users, bookings, viewMonth, viewYear);
    } catch (err) {
      alert('Failed to generate PDF. Please try again.');
      console.error('PDF generation error:', err);
    } finally {
      setExporting(false);
    }
  };

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
      // Fetch shift config for the date range, then book matching slots
      const startDateStr = blockStartDate;
      const endDateStr = blockEndDate;
      const [templates, overrides] = await Promise.all([
        fetchShiftTemplates(),
        fetchShiftOverridesByDateRange(startDateStr, endDateStr),
      ]);
      // Build a config map spanning all months in the range
      const startYear = start.getFullYear();
      const startMonth = start.getMonth();
      const endYear = end.getFullYear();
      const endMonth = end.getMonth();
      let configMap = {};
      for (let y = startYear, m = startMonth; y < endYear || (y === endYear && m <= endMonth); ) {
        const monthOverrides = overrides.filter(o => {
          const d = new Date(o.date);
          return d.getFullYear() === y && d.getMonth() === m;
        });
        Object.assign(configMap, buildShiftConfigMap(y, m, templates, monthOverrides));
        m++;
        if (m > 11) { m = 0; y++; }
      }
      let currDate = new Date(start);
      currDate.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      while (currDate <= endDate) {
        const dateKey = currDate.toISOString().slice(0, 10);
        const daySlots = configMap[dateKey] || [];
        for (const slot of daySlots) {
          const slotStart = new Date(`${dateKey}T${decimalHourToTimeStr(slot.start_hour).slice(0, 5)}`);
          if (slotStart >= start && slotStart < end) {
            await supabase.from('bookings').insert([{
              user_id: blockUserId,
              date: dateKey,
              start_time: decimalHourToTimeStr(slot.start_hour),
              end_time: computeEndTime(slot.start_hour, slot.duration_hours),
              status: 'booked',
            }]);
          }
        }
        currDate.setDate(currDate.getDate() + 1);
      }
      setBlockUserId('');
      setBlockStartDate('');
      setBlockStartTime('');
      setBlockEndDate('');
      setBlockEndTime('');
      // Refresh stats
      await new Promise(r => setTimeout(r, 500)); // Give DB a moment to update
      window.location.reload(); // crude but ensures stats update
    } catch (e) {
      setBlockError('Block failed');
    }
    setBlockLoading(false);
  };

  if (loading) return <div>Loading user stats...</div>;
  if (error) return <div style={{ color: '#a00' }}>{error}</div>;

  return (
    <div className={`admin-user-stats${darkMode ? ' dark-mode' : ''}`} style={{ margin: '2rem 0' }}>
      {/* Admin block shift UI */}
      {isAdmin && (
        <form onSubmit={handleBlockShift} style={{ marginBottom: 24, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}>
          <h3>Block Shift for User</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <select value={blockUserId} onChange={e => setBlockUserId(e.target.value)} required style={{ minWidth: 160 }}>
              <option value="">Select user</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</option>
              ))}
            </select>
            <input type="date" value={blockStartDate} onChange={e => setBlockStartDate(e.target.value)} required />
            <input type="time" value={blockStartTime} onChange={e => setBlockStartTime(e.target.value)} required />
            <span>to</span>
            <input type="date" value={blockEndDate} onChange={e => setBlockEndDate(e.target.value)} required />
            <input type="time" value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)} required />
            <button type="submit" disabled={blockLoading}>Block</button>
          </div>
          {blockError && <div style={{ color: '#a00', marginTop: 6 }}>{blockError}</div>}
        </form>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
            onClick={() => setMonthOffset(m => m - 1)}
            disabled={monthOffset === -24}
          >
            &lt; Prev
          </button>
          <h3>{MONTHS[viewMonth]} {viewYear}</h3>
          <button
            className={`calendar-nav-btn${darkMode ? ' dark-mode' : ''}`}
            onClick={() => setMonthOffset(m => m + 1)}
            disabled={monthOffset === 24}
          >
            Next &gt;
          </button>
        </div>
        <button
          className={`export-pdf-btn${darkMode ? ' dark-mode' : ''}`}
          onClick={handleExportPDF}
          disabled={exporting || loading}
        >
          {exporting ? 'Generating...' : 'Export Month PDF'}
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Hours Worked</th>
            <th>Hours Booked</th>
            <th>Cancellations</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{stats[u.id]?.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</td>
              <td>{stats[u.id]?.hoursWorked || 0}</td>
              <td>{stats[u.id]?.hoursBooked || 0}</td>
              <td>{stats[u.id]?.cancellations || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
